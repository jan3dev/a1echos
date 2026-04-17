import { Asset } from "expo-asset";
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import type { PcmLiveStreamHandle } from "react-native-sherpa-onnx/audio";
import { createPcmLiveStream } from "react-native-sherpa-onnx/audio";
import type { SttEngine } from "react-native-sherpa-onnx/stt";
import { createSTT } from "react-native-sherpa-onnx/stt";

import type { ModelInfo } from "@/models";
import { ModelId, SupportedLanguages, getModelInfo } from "@/models";
import { FeatureFlag, logError, logWarn } from "@/utils";

import { audioSessionService } from "./AudioSessionService";

// Lazy-loaded Simplified → Traditional Chinese converter (OpenCC)
let s2twConverter: ((text: string) => string) | null = null;
const convertToTraditional = (text: string): string => {
  if (!s2twConverter) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const OpenCC = require("opencc-js");
    s2twConverter = OpenCC.Converter({ from: "cn", to: "twp" });
  }
  return s2twConverter ? s2twConverter(text) : text;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const whisperEncoderAsset = require("@/assets/models/sherpa-whisper/tiny-encoder.int8.onnx");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const whisperDecoderAsset = require("@/assets/models/sherpa-whisper/tiny-decoder.int8.onnx");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const whisperTokensAsset = require("@/assets/models/sherpa-whisper/tiny-tokens.txt");

const BUNDLED_ASSETS: Record<string, number> = {
  "tiny-encoder.int8.onnx": whisperEncoderAsset,
  "tiny-decoder.int8.onnx": whisperDecoderAsset,
  "tiny-tokens.txt": whisperTokensAsset,
};

const IOS_NUM_THREADS = 2;

/** Minimum energy to consider as speech */
const SPEECH_ENERGY_THRESHOLD = 0.02;
/** Silence duration (ms) before triggering chunked transcription */
const SILENCE_TRIGGER_MS = 600;
/** Maximum chunk duration (ms) — transcribe even during continuous speech */
const MAX_CHUNK_DURATION_MS = 5000;
/** Sample rate for all audio processing */
const SAMPLE_RATE = 16000;

interface ServiceState {
  sttEngine: SttEngine | null;
  activeModelId: ModelId | null;
  activeLanguage: string | null;
  isInitialized: boolean;
  isInitializing: boolean;
  isTranscribing: boolean;
  isRealtimeRecording: boolean;
  initializationStatus: string | null;
  initializePromise: Promise<boolean> | null;

  // Realtime state
  pcmLiveStream: PcmLiveStreamHandle | null;
  pcmUnsubData: (() => void) | null;
  pcmUnsubError: (() => void) | null;
  audioBuffer: Float32Array[];
  audioBufferSampleCount: number;
  partialResults: string[];
  currentTranscription: string;
  chunkTimer: ReturnType<typeof setTimeout> | null;
  lastSpeechTime: number;
  isSpeaking: boolean;
  silenceTimer: ReturnType<typeof setTimeout> | null;

  // Callbacks
  partialCallbacks: Set<(text: string) => void>;
  audioLevelCallbacks: Set<(level: number) => void>;
}

const configureAudioSession = async (delayMs: number = 0): Promise<void> => {
  await audioSessionService.ensureRecordingMode();
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
};

/**
 * Get the directory URI for a downloaded (non-bundled) model.
 * Keeps the `file://` scheme so expo-file-system's `Directory` accepts it;
 * strip the prefix with `toNativePath` when passing to sherpa-onnx.
 */
const getDownloadedModelDir = (modelId: ModelId): string =>
  `${Paths.document.uri}/models/${modelId}`;

/** Strip the `file://` scheme for native code that wants a plain filesystem path. */
const toNativePath = (uri: string): string => uri.replace(/^file:\/\//, "");

/**
 * Prepare bundled model assets: download to local cache, then move into a
 * dedicated directory with the original filenames sherpa-onnx expects.
 * Uses move instead of copy to avoid doubling disk usage.
 */
const prepareBundledModel = async (
  modelInfo: ModelInfo,
  onStatus: (msg: string) => void,
): Promise<string> => {
  onStatus("Loading bundled model assets...");

  // Ensure parent directories exist
  const modelsParent = new Directory(Paths.cache, "models");
  modelsParent.create({ idempotent: true });
  const modelDir = new Directory(modelsParent, modelInfo.id);
  modelDir.create({ idempotent: true });

  const assetPromises = modelInfo.files.map(async (file) => {
    const assetModule = BUNDLED_ASSETS[file.name];
    if (!assetModule) {
      throw new Error(`No bundled asset found for ${file.name}`);
    }

    // Skip if the file already exists in the model directory
    const dest = new File(modelDir, file.name);
    if (dest.exists) return;

    const asset = Asset.fromModule(assetModule);
    await asset.downloadAsync();
    if (!asset.localUri) {
      throw new Error(`Failed to load asset: ${file.name}`);
    }

    // expo-asset uses hashed filenames — move to the model dir with the real name
    const cached = new File(asset.localUri);
    cached.move(dest);
  });

  await Promise.all(assetPromises);

  return modelDir.uri;
};

const createSherpaTranscriptionService = () => {
  const state: ServiceState = {
    sttEngine: null,
    activeModelId: null,
    activeLanguage: null,
    isInitialized: false,
    isInitializing: false,
    isTranscribing: false,
    isRealtimeRecording: false,
    initializationStatus: null,
    initializePromise: null,

    pcmLiveStream: null,
    pcmUnsubData: null,
    pcmUnsubError: null,
    audioBuffer: [],
    audioBufferSampleCount: 0,
    partialResults: [],
    currentTranscription: "",
    chunkTimer: null,
    lastSpeechTime: 0,
    isSpeaking: false,
    silenceTimer: null,

    partialCallbacks: new Set(),
    audioLevelCallbacks: new Set(),
  };

  // Audio level smoothing state
  let smoothedLevel = 0.0;
  let lastLevelTime: number | null = null;

  // --- Audio level computation (Float32 variant) ---

  const computeRmsFromFloat32 = (samples: Float32Array): number => {
    if (samples.length === 0) return 0;
    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) {
      sumSquares += samples[i] * samples[i];
    }
    const rms = Math.sqrt(sumSquares / samples.length);
    const boosted = Math.min(1.0, rms * 14);
    return Math.pow(boosted, 0.5);
  };

  const processAudioLevel = (samples: Float32Array): void => {
    const rawLevel = computeRmsFromFloat32(samples);
    const level = Math.max(0.02, Math.min(1.0, rawLevel));

    const now = Date.now();
    const dtMs =
      lastLevelTime === null
        ? 16
        : Math.max(0, Math.min(150, now - lastLevelTime));
    lastLevelTime = now;

    const rising = level > smoothedLevel;
    const baseAlpha = rising ? 0.92 : 0.7;
    const alpha = Math.max(
      0.6,
      Math.min(rising ? 0.95 : 0.8, baseAlpha * (dtMs / 16.0)),
    );

    smoothedLevel = smoothedLevel + (level - smoothedLevel) * alpha;
    const visual = Math.max(0.02, Math.min(1.0, smoothedLevel));

    state.audioLevelCallbacks.forEach((callback) => {
      try {
        callback(visual);
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.transcription,
          message: "Error in audio level callback",
        });
      }
    });
  };

  // --- Chunked transcription helpers ---

  const collectBufferedSamples = (): number[] | null => {
    if (state.audioBufferSampleCount === 0) return null;

    const combined = new Float32Array(state.audioBufferSampleCount);
    let offset = 0;
    for (const chunk of state.audioBuffer) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    state.audioBuffer = [];
    state.audioBufferSampleCount = 0;

    // Convert to plain number[] for sherpa-onnx bridge
    return Array.from(combined);
  };

  let isTranscribingChunk = false;

  const transcribeBufferedAudio = async (
    isFinalChunk = false,
  ): Promise<void> => {
    if (!state.sttEngine || (!state.isRealtimeRecording && !isFinalChunk))
      return;
    if (isTranscribingChunk) return; // Prevent concurrent transcription calls

    const samples = collectBufferedSamples();
    if (!samples || samples.length < SAMPLE_RATE * 0.3) return; // Skip if less than 300ms

    isTranscribingChunk = true;
    try {
      const result = await state.sttEngine.transcribeSamples(
        samples,
        SAMPLE_RATE,
      );
      const rawText = result.text?.trim();
      const text = rawText ? postProcessText(rawText) : rawText;
      if (text) {
        state.partialResults.push(text);
        state.currentTranscription = state.partialResults.join(" ");

        state.partialCallbacks.forEach((callback) => {
          try {
            callback(state.currentTranscription);
          } catch (error) {
            logError(error, {
              flag: FeatureFlag.transcription,
              message: "Error in partial callback",
            });
          }
        });
      }
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.transcription,
        message: "Error transcribing audio chunk",
      });
    } finally {
      isTranscribingChunk = false;
    }
  };

  const scheduleMaxChunkTimer = (): void => {
    clearChunkTimer();
    state.chunkTimer = setTimeout(async () => {
      if (state.isRealtimeRecording) {
        await transcribeBufferedAudio();
        scheduleMaxChunkTimer();
      }
    }, MAX_CHUNK_DURATION_MS);
  };

  const clearChunkTimer = (): void => {
    if (state.chunkTimer) {
      clearTimeout(state.chunkTimer);
      state.chunkTimer = null;
    }
  };

  const clearSilenceTimer = (): void => {
    if (state.silenceTimer) {
      clearTimeout(state.silenceTimer);
      state.silenceTimer = null;
    }
  };

  const handleAudioData = (samples: Float32Array): void => {
    if (!state.isRealtimeRecording) return;

    // Buffer audio
    state.audioBuffer.push(samples);
    state.audioBufferSampleCount += samples.length;

    // Process audio level
    processAudioLevel(samples);

    // Speech boundary detection
    const energy = computeRmsFromFloat32(samples);
    const now = Date.now();

    if (energy > SPEECH_ENERGY_THRESHOLD) {
      state.isSpeaking = true;
      state.lastSpeechTime = now;
      clearSilenceTimer();
    } else if (state.isSpeaking) {
      // Energy dropped — start silence timer if not already running
      if (!state.silenceTimer) {
        state.silenceTimer = setTimeout(async () => {
          if (
            state.isRealtimeRecording &&
            Date.now() - state.lastSpeechTime >= SILENCE_TRIGGER_MS
          ) {
            state.isSpeaking = false;
            await transcribeBufferedAudio();
            scheduleMaxChunkTimer(); // Reset the max chunk timer
          }
        }, SILENCE_TRIGGER_MS);
      }
    }
  };

  // --- Core service methods ---

  /** Post-process transcription output for languages that need it (e.g., zh-hant) */
  const postProcessText = (text: string): string => {
    if (state.activeLanguage === "zh-hant") {
      return convertToTraditional(text);
    }
    return text;
  };

  const doInitialize = async (
    modelId: ModelId = ModelId.WHISPER_TINY,
    languageCode: string = "en",
  ): Promise<boolean> => {
    state.isInitializing = true;
    state.initializationStatus = "Starting initialization...";

    try {
      await configureAudioSession(100);

      const modelInfo = getModelInfo(modelId);
      let modelDir: string;

      if (modelInfo.isBundled) {
        modelDir = await prepareBundledModel(modelInfo, (msg) => {
          state.initializationStatus = msg;
        });
      } else {
        modelDir = getDownloadedModelDir(modelId);
        const dir = new Directory(modelDir);
        if (!dir.exists) {
          throw new Error(`Model not downloaded: ${modelId}`);
        }
      }

      state.initializationStatus = "Initializing transcription engine...";

      // Derive the whisper language from the user's language code
      // (e.g., "zh-hant" → "zh" for the engine, but we keep the original for post-processing)
      const { language: whisperLanguage } =
        SupportedLanguages.transcribeOptionsFor(languageCode);

      const sttEngine = await createSTT({
        modelPath: { type: "file", path: toNativePath(modelDir) },
        modelType: modelInfo.sherpaModelType as
          | "whisper"
          | "nemo_transducer"
          | "qwen3_asr",
        preferInt8: true,
        numThreads: Platform.OS === "ios" ? IOS_NUM_THREADS : undefined,
        modelOptions:
          modelInfo.sherpaModelType === "whisper"
            ? {
                whisper: {
                  language: whisperLanguage ?? languageCode,
                  task: "transcribe",
                },
              }
            : undefined,
      });

      state.sttEngine = sttEngine;
      state.activeModelId = modelId;
      state.activeLanguage = languageCode;
      state.isInitialized = true;
      state.initializationStatus = "Ready";
      return true;
    } catch (error) {
      state.initializationStatus = `Initialization failed: ${error}`;
      logError(error, {
        flag: FeatureFlag.model,
        message: "Sherpa-onnx initialization failed",
      });
      resetState();
      return false;
    } finally {
      state.isInitializing = false;
      state.initializePromise = null;
    }
  };

  const initialize = async (
    modelId?: ModelId,
    languageCode: string = "en",
  ): Promise<boolean> => {
    // If an initialization is already in flight, wait for it
    if (state.initializePromise) {
      return state.initializePromise;
    }

    const targetModelId = modelId ?? ModelId.WHISPER_TINY;

    // Re-initialize if model or language changed (Whisper sets language at init time)
    const needsReinit =
      !state.isInitialized ||
      state.activeModelId !== targetModelId ||
      (state.activeLanguage !== languageCode &&
        getModelInfo(targetModelId).sherpaModelType === "whisper");

    if (!needsReinit) {
      return true;
    }

    // If switching models or language, dispose the current engine first
    if (state.isInitialized) {
      await dispose();
    }

    state.initializePromise = doInitialize(targetModelId, languageCode);
    return state.initializePromise;
  };

  const transcribeFile = async (audioPath: string): Promise<string | null> => {
    if (!state.isInitialized || !state.sttEngine) {
      throw new Error("Transcription service not initialized");
    }

    if (state.isTranscribing) {
      throw new Error("Transcription already in progress");
    }

    try {
      state.isTranscribing = true;

      // sherpa-onnx expects a plain filesystem path, not a file:// URI
      const filePath = audioPath.replace(/^file:\/\//, "");

      // AudioService already records in 16kHz mono 16-bit PCM WAV format,
      // which is exactly what sherpa-onnx's WaveReader expects — no conversion needed.
      const result = await state.sttEngine.transcribeFile(filePath);
      const text = result.text?.trim() || null;
      return text ? postProcessText(text) : null;
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.transcription,
        message: "File transcription failed",
      });
      throw error;
    } finally {
      state.isTranscribing = false;
    }
  };

  const startRealtimeTranscription = async (): Promise<boolean> => {
    if (!state.isInitialized || !state.sttEngine) {
      logError("Cannot start real-time: engine not initialized", {
        flag: FeatureFlag.transcription,
      });
      return false;
    }

    if (state.isRealtimeRecording) {
      logError("Real-time transcription already in progress", {
        flag: FeatureFlag.transcription,
      });
      return false;
    }

    if (state.isTranscribing) {
      logError("Cannot start real-time: file transcription in progress", {
        flag: FeatureFlag.transcription,
      });
      return false;
    }

    try {
      // Reset realtime state
      state.currentTranscription = "";
      state.partialResults = [];
      state.audioBuffer = [];
      state.audioBufferSampleCount = 0;
      state.isSpeaking = false;
      state.lastSpeechTime = 0;
      smoothedLevel = 0.0;
      lastLevelTime = null;

      await configureAudioSession(100);

      // Create PCM live stream from sherpa-onnx
      const pcmStream = createPcmLiveStream({
        sampleRate: SAMPLE_RATE,
        channelCount: 1,
      });

      state.pcmLiveStream = pcmStream;

      // Subscribe to audio data
      state.pcmUnsubData = pcmStream.onData((samples) => {
        handleAudioData(samples);
      });

      // Subscribe to errors
      state.pcmUnsubError = pcmStream.onError((message) => {
        logError(message, {
          flag: FeatureFlag.transcription,
          message: "PCM live stream error",
        });
      });

      // Start capturing audio
      await pcmStream.start();
      state.isRealtimeRecording = true;

      // Start max chunk timer
      scheduleMaxChunkTimer();

      return true;
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.transcription,
        message: "Error starting real-time recording",
      });
      await cleanupRealtimeResources();
      return false;
    }
  };

  const stopRealtimeTranscription = async (): Promise<string> => {
    if (!state.isRealtimeRecording) {
      logWarn("No real-time transcription in progress", {
        flag: FeatureFlag.transcription,
      });
      return "";
    }

    try {
      // Stop audio capture
      if (state.pcmLiveStream) {
        await state.pcmLiveStream.stop();
      }

      state.isRealtimeRecording = false;

      // Transcribe any remaining buffered audio (final chunk bypasses isRealtimeRecording guard)
      await transcribeBufferedAudio(true);

      return state.currentTranscription;
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.transcription,
        message: "Failed to stop real-time recording",
      });
      return state.currentTranscription;
    } finally {
      await cleanupRealtimeResources();
    }
  };

  const cleanupRealtimeResources = async (): Promise<void> => {
    clearChunkTimer();
    clearSilenceTimer();

    if (state.pcmUnsubData) {
      state.pcmUnsubData();
      state.pcmUnsubData = null;
    }
    if (state.pcmUnsubError) {
      state.pcmUnsubError();
      state.pcmUnsubError = null;
    }
    if (state.pcmLiveStream) {
      try {
        await state.pcmLiveStream.stop();
      } catch {
        // Already stopped
      }
      state.pcmLiveStream = null;
    }

    state.audioBuffer = [];
    state.audioBufferSampleCount = 0;
    state.isRealtimeRecording = false;
    state.isSpeaking = false;
    smoothedLevel = 0.0;
    lastLevelTime = null;

    state.audioLevelCallbacks.forEach((callback) => {
      try {
        callback(0.02);
      } catch {
        // Ignore
      }
    });
  };

  const switchModel = async (modelId: ModelId): Promise<boolean> => {
    if (state.activeModelId === modelId && state.isInitialized) {
      return true;
    }

    if (state.isRealtimeRecording) {
      await stopRealtimeTranscription();
    }

    await dispose();
    return initialize(modelId);
  };

  const subscribeToPartialResults = (
    callback: (text: string) => void,
  ): (() => void) => {
    state.partialCallbacks.add(callback);
    return () => {
      state.partialCallbacks.delete(callback);
    };
  };

  const subscribeToAudioLevel = (
    callback: (level: number) => void,
  ): (() => void) => {
    state.audioLevelCallbacks.add(callback);
    return () => {
      state.audioLevelCallbacks.delete(callback);
    };
  };

  const dispose = async (): Promise<void> => {
    if (state.isRealtimeRecording) {
      await stopRealtimeTranscription();
    }

    await cleanupRealtimeResources();

    if (state.sttEngine) {
      try {
        await state.sttEngine.destroy();
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.model,
          message: "Error destroying STT engine",
        });
      }
    }

    state.partialCallbacks.clear();
    state.audioLevelCallbacks.clear();
    resetState();
  };

  const resetState = (): void => {
    state.sttEngine = null;
    state.activeModelId = null;
    state.activeLanguage = null;
    state.isInitialized = false;
    state.isInitializing = false;
    state.isTranscribing = false;
    state.isRealtimeRecording = false;
    state.currentTranscription = "";
    state.partialResults = [];
  };

  return {
    initialize,
    transcribeFile,
    startRealtimeTranscription,
    stopRealtimeTranscription,
    subscribeToPartialResults,
    subscribeToAudioLevel,
    switchModel,
    dispose,
    get initializationStatus() {
      return state.initializationStatus;
    },
    get activeModelId() {
      return state.activeModelId;
    },
  };
};

export const sherpaTranscriptionService = createSherpaTranscriptionService();
export default sherpaTranscriptionService;
