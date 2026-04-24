/* eslint-disable @typescript-eslint/no-require-imports */
import { Asset } from "expo-asset";
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import type { PcmLiveStreamHandle } from "react-native-sherpa-onnx/audio";
import type { SttEngine } from "react-native-sherpa-onnx/stt";

import { AppConstants } from "@/constants";
import type { ModelInfo } from "@/models";
import { getModelInfo, ModelId, SupportedLanguages } from "@/models";
import {
  createPcmStreamWriter,
  FeatureFlag,
  logError,
  logWarn,
  PcmStreamWriter,
} from "@/utils";

import { audioSessionService } from "./AudioSessionService";

// Lazy-loaded sherpa-onnx native bindings. Deferred so Storybook (which runs
// without a native bridge) can evaluate this module without hitting
// TurboModuleRegistry.getEnforcing at import time.
type CreatePcmLiveStream =
  typeof import("react-native-sherpa-onnx/audio").createPcmLiveStream;
type CreateSTT = typeof import("react-native-sherpa-onnx/stt").createSTT;

let cachedCreatePcmLiveStream: CreatePcmLiveStream | null = null;
let cachedCreateSTT: CreateSTT | null = null;

const loadCreatePcmLiveStream = (): CreatePcmLiveStream => {
  if (!cachedCreatePcmLiveStream) {
    cachedCreatePcmLiveStream =
      require("react-native-sherpa-onnx/audio").createPcmLiveStream;
  }
  return cachedCreatePcmLiveStream!;
};

const loadCreateSTT = (): CreateSTT => {
  if (!cachedCreateSTT) {
    cachedCreateSTT = require("react-native-sherpa-onnx/stt").createSTT;
  }
  return cachedCreateSTT!;
};

// Lazy-loaded Simplified → Traditional Chinese converter (OpenCC)
let s2twConverter: ((text: string) => string) | null = null;
const convertToTraditional = (text: string): string => {
  if (!s2twConverter) {
    const OpenCC = require("opencc-js");
    s2twConverter = OpenCC.Converter({ from: "cn", to: "twp" });
  }
  return s2twConverter ? s2twConverter(text) : text;
};

const whisperEncoderAsset = require("@/assets/models/sherpa-whisper/tiny-encoder.int8.onnx");
const whisperDecoderAsset = require("@/assets/models/sherpa-whisper/tiny-decoder.int8.onnx");
const whisperTokensAsset = require("@/assets/models/sherpa-whisper/tiny-tokens.txt");

const BUNDLED_ASSETS: Record<string, number> = {
  "tiny-encoder.int8.onnx": whisperEncoderAsset,
  "tiny-decoder.int8.onnx": whisperDecoderAsset,
  "tiny-tokens.txt": whisperTokensAsset,
};

const IOS_NUM_THREADS = 2;
const SAMPLE_RATE = AppConstants.AUDIO_SAMPLE_RATE;
const NUM_CHANNELS = AppConstants.AUDIO_NUM_CHANNELS;
const BITS_PER_SAMPLE = 16;
const MAX_CHUNK_DURATION_MS = 5000;
const MIN_CHUNK_SECONDS = 0.3;
const LONG_PAUSE_MS = AppConstants.SMART_SPLIT_LONG_PAUSE_MS;
const ENERGY_THRESHOLD = AppConstants.SMART_SPLIT_SILENCE_ENERGY_THRESHOLD;

export type ChunkBoundary = "none" | "long" | "final";

export interface ChunkEvent {
  /** Newly-transcribed text for this chunk (may be "" on a long-pause upgrade). */
  text: string;
  /** Structural hint about the silence that followed this chunk, if any. */
  boundary: ChunkBoundary;
}

export interface StartRealtimeOptions {
  /**
   * If provided, PCM samples are mirrored into a WAV file at this URI
   * (including the `file://` scheme) while recording. Used by file-mode so the
   * recording is available for playback attachment on single-item runs. The
   * same URI is returned by {@link stopRealtimeTranscription} once finalized.
   */
  wavOutputUri?: string;
}

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
  chunkTimer: ReturnType<typeof setTimeout> | null;
  lastSpeechTime: number;
  isSpeaking: boolean;
  longPauseTimer: ReturnType<typeof setTimeout> | null;

  // Optional WAV sidecar (file-mode)
  pcmStreamWriter: PcmStreamWriter | null;
  wavOutputUri: string | null;

  // Callbacks
  chunkCallbacks: Set<(event: ChunkEvent) => void>;
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
    chunkTimer: null,
    lastSpeechTime: 0,
    isSpeaking: false,
    longPauseTimer: null,

    pcmStreamWriter: null,
    wavOutputUri: null,

    chunkCallbacks: new Set(),
    audioLevelCallbacks: new Set(),
  };

  // Audio level smoothing state
  let smoothedLevel = 0.0;
  let lastLevelTime: number | null = null;

  // --- Audio level computation (Float32 variant) ---

  /** Raw linear RMS of Float32 samples in [0, 1]. Used for VAD thresholding. */
  const computeRawRmsFromFloat32 = (samples: Float32Array): number => {
    if (samples.length === 0) return 0;
    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) {
      sumSquares += samples[i] * samples[i];
    }
    return Math.sqrt(sumSquares / samples.length);
  };

  const processAudioLevel = (rawRms: number): void => {
    const boosted = Math.min(1.0, rawRms * 14);
    const visualRaw = Math.pow(boosted, 0.5);
    const level = Math.max(0.02, Math.min(1.0, visualRaw));

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

  // --- Chunk emission ---

  const emitChunk = (event: ChunkEvent): void => {
    state.chunkCallbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.transcription,
          message: "Error in chunk callback",
        });
      }
    });
  };

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
    boundary: ChunkBoundary,
  ): Promise<void> => {
    const isFinalChunk = boundary === "final";
    if (!state.sttEngine || (!state.isRealtimeRecording && !isFinalChunk))
      return;
    if (isTranscribingChunk) return; // Prevent concurrent transcription calls

    const samples = collectBufferedSamples();
    if (!samples || samples.length < SAMPLE_RATE * MIN_CHUNK_SECONDS) {
      // Nothing worth transcribing — emit a zero-text boundary so the store
      // can still advance its item state for `final` / `long`.
      if (boundary === "final" || boundary === "long") {
        emitChunk({ text: "", boundary });
      }
      return;
    }

    isTranscribingChunk = true;
    try {
      const result = await state.sttEngine.transcribeSamples(
        samples,
        SAMPLE_RATE,
      );
      const rawText = result.text?.trim();
      const text = rawText ? postProcessText(rawText) : "";
      emitChunk({ text, boundary });
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.transcription,
        message: "Error transcribing audio chunk",
      });
      if (boundary === "final" || boundary === "long") {
        emitChunk({ text: "", boundary });
      }
    } finally {
      isTranscribingChunk = false;
    }
  };

  const scheduleMaxChunkTimer = (): void => {
    clearChunkTimer();
    state.chunkTimer = setTimeout(async () => {
      if (!state.isRealtimeRecording) return;
      await transcribeBufferedAudio("none");
      // Re-check after the await — recording may have stopped during transcribe
      // and cleared the timer; rescheduling would leak it.
      if (state.isRealtimeRecording) {
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

  const clearPauseTimers = (): void => {
    if (state.longPauseTimer) {
      clearTimeout(state.longPauseTimer);
      state.longPauseTimer = null;
    }
  };

  const float32ToInt16PcmBytes = (samples: Float32Array): Uint8Array => {
    const bytes = new Uint8Array(samples.length * 2);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < samples.length; i++) {
      const clamped = Math.max(-1, Math.min(1, samples[i]));
      const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      view.setInt16(i * 2, int16 | 0, true);
    }
    return bytes;
  };

  const handleAudioData = (samples: Float32Array): void => {
    if (!state.isRealtimeRecording) return;

    if (state.pcmStreamWriter) {
      state.pcmStreamWriter.write(float32ToInt16PcmBytes(samples));
    }

    state.audioBuffer.push(samples);
    state.audioBufferSampleCount += samples.length;

    const energy = computeRawRmsFromFloat32(samples);
    processAudioLevel(energy);

    const now = Date.now();

    if (energy > ENERGY_THRESHOLD) {
      state.isSpeaking = true;
      state.lastSpeechTime = now;
      clearPauseTimers();
    } else if (state.isSpeaking && !state.longPauseTimer) {
      // Energy dropped — arm the long-pause timer. When it fires we emit a
      // `long` boundary so the store finalizes the in-progress item.
      state.longPauseTimer = setTimeout(() => {
        state.longPauseTimer = null;
        if (
          !state.isRealtimeRecording ||
          Date.now() - state.lastSpeechTime < LONG_PAUSE_MS
        ) {
          return;
        }
        state.isSpeaking = false;
        emitChunk({ text: "", boundary: "long" });
      }, LONG_PAUSE_MS);
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

      const sttEngine = await loadCreateSTT()({
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
    const targetModelId = modelId ?? ModelId.WHISPER_TINY;

    // If an init is already in flight, wait for it — then re-check, since the
    // in-flight init may have been for a different model/language than we want.
    if (state.initializePromise) {
      await state.initializePromise;
      return initialize(targetModelId, languageCode);
    }

    // Whisper sets language at init time; other model types read it at runtime.
    const needsReinit =
      !state.isInitialized ||
      state.activeModelId !== targetModelId ||
      (state.activeLanguage !== languageCode &&
        getModelInfo(targetModelId).sherpaModelType === "whisper");

    if (!needsReinit) {
      return true;
    }

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

      const filePath = toNativePath(audioPath);
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

  const startRealtimeTranscription = async (
    options: StartRealtimeOptions = {},
  ): Promise<boolean> => {
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
      state.audioBuffer = [];
      state.audioBufferSampleCount = 0;
      state.isSpeaking = false;
      state.lastSpeechTime = 0;
      smoothedLevel = 0.0;
      lastLevelTime = null;

      if (options.wavOutputUri) {
        state.wavOutputUri = options.wavOutputUri;
        state.pcmStreamWriter = createPcmStreamWriter(
          options.wavOutputUri,
          SAMPLE_RATE,
          NUM_CHANNELS,
          BITS_PER_SAMPLE,
        );
      }

      await configureAudioSession(100);

      const pcmStream = loadCreatePcmLiveStream()({
        sampleRate: SAMPLE_RATE,
        channelCount: NUM_CHANNELS,
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

  /**
   * Stop capture, flush the final buffered chunk, and finalize the WAV sidecar
   * if one was requested. Returns the WAV path on success, or `null` when no
   * sidecar was requested or finalization failed.
   */
  const stopRealtimeTranscription = async (): Promise<string | null> => {
    if (!state.isRealtimeRecording) {
      logWarn("No real-time transcription in progress", {
        flag: FeatureFlag.transcription,
      });
      return null;
    }

    let wavPath: string | null = null;

    try {
      // Clear pause/chunk timers up-front so in-flight callbacks cannot emit
      // a spurious boundary after we've flipped isRealtimeRecording.
      clearChunkTimer();
      clearPauseTimers();

      if (state.pcmLiveStream) {
        await state.pcmLiveStream.stop();
        state.pcmLiveStream = null;
      }
      state.isRealtimeRecording = false;

      await transcribeBufferedAudio("final");

      if (state.pcmStreamWriter && state.wavOutputUri) {
        const success = await state.pcmStreamWriter.finalize();
        wavPath = success ? state.wavOutputUri : null;
      }
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.transcription,
        message: "Failed to stop real-time recording",
      });
    } finally {
      await cleanupRealtimeResources();
    }

    return wavPath;
  };

  const cleanupRealtimeResources = async (): Promise<void> => {
    clearChunkTimer();
    clearPauseTimers();

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

    // Abort the WAV writer if it wasn't finalized (e.g. start-failure path).
    if (state.pcmStreamWriter) {
      try {
        await state.pcmStreamWriter.abort();
      } catch {
        // Ignore — abort is best-effort.
      }
      state.pcmStreamWriter = null;
    }
    state.wavOutputUri = null;

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

    const previousModelId = state.activeModelId;
    const previousLanguage = state.activeLanguage;

    await dispose();
    const ok = await initialize(modelId);
    if (ok || !previousModelId) return ok;

    // Init failed — try to restore the previous model so the app isn't wedged.
    logWarn(`Model switch to ${modelId} failed; restoring ${previousModelId}`, {
      flag: FeatureFlag.model,
    });
    await initialize(previousModelId, previousLanguage ?? "en");
    return false;
  };

  const subscribeToChunk = (
    callback: (event: ChunkEvent) => void,
  ): (() => void) => {
    state.chunkCallbacks.add(callback);
    return () => {
      state.chunkCallbacks.delete(callback);
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

    state.chunkCallbacks.clear();
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
  };

  return {
    initialize,
    transcribeFile,
    startRealtimeTranscription,
    stopRealtimeTranscription,
    subscribeToChunk,
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
