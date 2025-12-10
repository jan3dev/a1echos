import { Asset } from 'expo-asset';
import { AudioModule, AudioRecorder, RecordingOptions, setAudioModeAsync } from 'expo-audio';
import { File } from 'expo-file-system';
import RNFS from 'react-native-fs';
// @ts-ignore - whisper.rn may not have complete type declarations
import { initWhisper, initWhisperVad, type WhisperContext, type WhisperVadContext } from 'whisper.rn';
// @ts-ignore - whisper.rn may not have complete type declarations
import { RealtimeTranscriber } from 'whisper.rn/src/realtime-transcription';
// @ts-ignore - whisper.rn may not have complete type declarations
import { AudioPcmStreamAdapter } from 'whisper.rn/src/realtime-transcription/adapters/AudioPcmStreamAdapter';

interface RealtimeTranscribeEvent {
  type: 'error' | 'start' | 'transcribe' | 'end';
  sliceIndex: number;
  data?: { result: string };
  isCapturing: boolean;
  processTime: number;
  recordingTime: number;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const modelAsset = require('../assets/models/whisper/ggml-tiny.bin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vadModelAsset = require('../assets/models/whisper/ggml-silero-v6.2.0.bin');

interface WhisperServiceState {
  whisperContext: WhisperContext | null;
  vadContext: WhisperVadContext | null;
  realtimeTranscriber: RealtimeTranscriber | null;
  realtimeAudioStream: AudioPcmStreamAdapter | null;
  isInitialized: boolean;
  isInitializing: boolean;
  isTranscribing: boolean;
  isRealtimeRecording: boolean;
  currentTranscription: string;
  initializationStatus: string | null;
  partialCallbacks: Set<(text: string) => void>;
  audioLevelCallbacks: Set<(level: number) => void>;
  smoothedAudioLevel: number;
}

const configureAudioSession = async (delayMs: number = 0): Promise<void> => {
  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
    shouldPlayInBackground: true,
  });
  if (delayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
};

const createWhisperService = () => {
  const state: WhisperServiceState = {
    whisperContext: null,
    vadContext: null,
    realtimeTranscriber: null,
    realtimeAudioStream: null,
    isInitialized: false,
    isInitializing: false,
    isTranscribing: false,
    isRealtimeRecording: false,
    currentTranscription: '',
    initializationStatus: null,
    partialCallbacks: new Set(),
    audioLevelCallbacks: new Set(),
    smoothedAudioLevel: 0,
  };

  const computeRmsLevel = (data: Uint8Array): number => {
    if (data.length === 0) return 0;

    let sumSquares = 0;
    const samples = data.length / 2;

    for (let i = 0; i < data.length - 1; i += 2) {
      // 16-bit little-endian signed PCM
      const sample = (data[i] | (data[i + 1] << 8)) - 32768;
      const normalized = sample / 32768;
      sumSquares += normalized * normalized;
    }

    const rms = Math.sqrt(sumSquares / samples);
    const boosted = Math.min(1.0, rms * 8);
    const level = Math.pow(boosted, 0.7);
    return level;
  };

  const emitAudioLevel = (level: number): void => {
    const rising = level > state.smoothedAudioLevel;
    const alpha = rising ? 0.4 : 0.15;
    state.smoothedAudioLevel = state.smoothedAudioLevel + (level - state.smoothedAudioLevel) * alpha;
    
    const visual = Math.max(0.02, Math.min(1.0, state.smoothedAudioLevel));
    state.audioLevelCallbacks.forEach((callback) => {
      try {
        callback(visual);
      } catch (error) {
        console.error('Error in audio level callback:', error);
      }
    });
  };

  const prepareModel = async (): Promise<string> => {
    state.initializationStatus = 'Loading model asset...';

    const asset = Asset.fromModule(modelAsset);
    await asset.downloadAsync();

    if (!asset.localUri) {
      throw new Error('Failed to load model asset');
    }

    state.initializationStatus = 'Model loaded successfully';
    return asset.localUri;
  };

  const prepareVadModel = async (): Promise<string> => {
    state.initializationStatus = 'Loading VAD model asset...';

    const asset = Asset.fromModule(vadModelAsset);
    await asset.downloadAsync();

    if (!asset.localUri) {
      throw new Error('Failed to load VAD model asset');
    }

    state.initializationStatus = 'VAD model loaded successfully';
    return asset.localUri;
  };

  const initialize = async (): Promise<boolean> => {
    if (state.isInitialized) {
      return true;
    }

    if (state.isInitializing) {
      return false;
    }

    state.isInitializing = true;
    state.initializationStatus = 'Starting initialization...';

    try {
      // Pre-configure audio session to avoid issues with real-time mode
      await configureAudioSession();
      
      // Warm up the audio system by briefly preparing a recorder
      // This ensures iOS audio infrastructure is fully initialized
      try {
        const warmupOptions: RecordingOptions = {
          extension: '.wav',
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          ios: {
            outputFormat: 'linearpcm',
            audioQuality: 127,
            sampleRate: 16000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          android: {
            extension: '.wav',
            outputFormat: 'default',
            audioEncoder: 'default',
            sampleRate: 16000,
          },
          web: {
            mimeType: 'audio/wav',
            bitsPerSecond: 128000,
          },
        };
        const warmupRecorder = new (AudioModule as { AudioRecorder: new (options: RecordingOptions) => AudioRecorder }).AudioRecorder(warmupOptions);
        await warmupRecorder.prepareToRecordAsync();
        warmupRecorder.release();
      } catch (warmupError) {
        console.warn('[WhisperService] Audio warmup failed (non-fatal):', warmupError);
      }
      
      await configureAudioSession(50);

      const modelPath = await prepareModel();

      state.initializationStatus = 'Initializing Whisper context...';

      state.whisperContext = await initWhisper({
        filePath: modelPath,
      });

      const vadModelPath = await prepareVadModel();

      state.initializationStatus = 'Initializing VAD context...';

      state.vadContext = await initWhisperVad({
        filePath: vadModelPath,
        useGpu: true,
        nThreads: 4,
      });

      state.isInitialized = true;
      state.initializationStatus = 'Whisper ready';
      return true;
    } catch (error) {
      state.initializationStatus = `Initialization failed: ${error}`;
      console.error('Whisper initialization failed:', error);
      resetState();
      return false;
    } finally {
      state.isInitializing = false;
    }
  };

  const transcribeFile = async (
    audioPath: string,
    languageCode?: string
  ): Promise<string | null> => {
    if (!state.isInitialized || !state.whisperContext) {
      throw new Error('Whisper service not initialized');
    }

    if (state.isTranscribing) {
      throw new Error('Transcription already in progress');
    }

    const audioFile = new File(audioPath);
    if (!audioFile.exists) {
      throw new Error(`Audio file not found at: ${audioPath}`);
    }

    try {
      state.isTranscribing = true;

      const options = languageCode ? { language: languageCode } : {};
      const { promise } = state.whisperContext.transcribe(audioPath, options);

      const result = await promise;
      return result?.result?.trim() || null;
    } catch (error) {
      console.error('Whisper file transcription failed:', error);
      throw error;
    } finally {
      state.isTranscribing = false;
    }
  };

  const startRealtimeTranscription = async (
    languageCode?: string
  ): Promise<boolean> => {
    if (!state.isInitialized || !state.whisperContext || !state.vadContext) {
      console.error('Cannot start real-time: Whisper or VAD not initialized');
      return false;
    }

    if (state.isRealtimeRecording) {
      console.error('Real-time transcription already in progress');
      return false;
    }

    if (state.isTranscribing) {
      console.error('Cannot start real-time: file transcription in progress');
      return false;
    }

    try {
      state.currentTranscription = '';
      state.smoothedAudioLevel = 0;

      // Configure audio session for recording BEFORE creating AudioPcmStreamAdapter
      await configureAudioSession(100);

      const audioStream = new AudioPcmStreamAdapter();
      state.realtimeAudioStream = audioStream;

      audioStream.onData((audioData: { data: Uint8Array }) => {
        if (audioData.data) {
          const level = computeRmsLevel(audioData.data);
          emitAudioLevel(level);
        }
      });

      const transcribeOptions: Record<string, unknown> = {};
      if (languageCode) {
        transcribeOptions.language = languageCode;
      }

      const transcriber = new RealtimeTranscriber(
        {
          whisperContext: state.whisperContext,
          vadContext: state.vadContext,
          audioStream,
          fs: RNFS,
        },
        {
          audioSliceSec: 30,
          audioMinSec: 0.5,
          maxSlicesInMemory: 1,
          vadPreset: 'default',
          autoSliceOnSpeechEnd: true,
          autoSliceThreshold: 0.5,
          transcribeOptions,
        },
        {
          onTranscribe: (event: RealtimeTranscribeEvent) => {
            try {
              if (event.data?.result) {
                const allResults = state.realtimeTranscriber?.getTranscriptionResults() || [];
                const aggregatedText = allResults
                  .map(({ transcribeEvent }: { transcribeEvent: RealtimeTranscribeEvent }) => transcribeEvent.data?.result?.trim())
                  .filter(Boolean)
                  .join(' ');

                const text = aggregatedText || event.data.result.trim();
                state.currentTranscription = text;

                state.partialCallbacks.forEach((callback) => {
                  try {
                    callback(text);
                  } catch (error) {
                    console.error('Error in partial callback:', error);
                  }
                });
              }
            } catch (error) {
              console.error('Error handling transcription event:', error);
            }
          },
          onError: (error: string) => {
            console.error('RealtimeTranscriber error:', error);
          },
          onStatusChange: (isActive: boolean) => {
            state.isRealtimeRecording = isActive;
          },
        }
      );

      state.realtimeTranscriber = transcriber;

      await transcriber.start();
      // Set isRealtimeRecording immediately after start to avoid race condition
      // (onStatusChange callback may not have fired yet)
      state.isRealtimeRecording = true;

      return true;
    } catch (error) {
      console.error('Error starting real-time recording:', error);
      cleanupRealtimeResources();
      state.isRealtimeRecording = false;
      return false;
    }
  };

  const stopRealtimeTranscription = async (): Promise<string> => {
    if (!state.isRealtimeRecording || !state.realtimeTranscriber) {
      console.warn('No real-time transcription in progress');
      return '';
    }

    try {
      await state.realtimeTranscriber.stop();

      const allResults = state.realtimeTranscriber.getTranscriptionResults() || [];
      const finalText = allResults
        .map(({ transcribeEvent }: { transcribeEvent: RealtimeTranscribeEvent }) => transcribeEvent.data?.result?.trim())
        .filter(Boolean)
        .join(' ');

      state.currentTranscription = finalText || state.currentTranscription;

      return state.currentTranscription;
    } catch (error) {
      console.error('Failed to stop real-time recording:', error);
      return state.currentTranscription;
    } finally {
      cleanupRealtimeResources();
    }
  };

  const cleanupRealtimeResources = (): void => {
    if (state.realtimeTranscriber) {
      try {
        state.realtimeTranscriber.release();
      } catch (error) {
        console.error('Error releasing RealtimeTranscriber:', error);
      }
    }

    state.realtimeTranscriber = null;
    state.realtimeAudioStream = null;
    state.isRealtimeRecording = false;
    state.smoothedAudioLevel = 0;
    state.audioLevelCallbacks.forEach((callback) => {
      try {
        callback(0.02);
      } catch {}
    });
  };

  const subscribeToPartialResults = (
    callback: (text: string) => void
  ): (() => void) => {
    state.partialCallbacks.add(callback);

    return () => {
      state.partialCallbacks.delete(callback);
    };
  };

  const subscribeToAudioLevel = (
    callback: (level: number) => void
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

    cleanupRealtimeResources();

    if (state.vadContext) {
      try {
        await state.vadContext.release();
      } catch (error) {
        console.error('Error releasing VAD context:', error);
      }
    }

    if (state.whisperContext) {
      try {
        await state.whisperContext.release();
      } catch (error) {
        console.error('Error releasing Whisper context:', error);
      }
    }

    state.partialCallbacks.clear();
    resetState();
  };

  const resetState = (): void => {
    state.whisperContext = null;
    state.vadContext = null;
    state.realtimeTranscriber = null;
    state.realtimeAudioStream = null;
    state.isInitialized = false;
    state.isInitializing = false;
    state.isTranscribing = false;
    state.isRealtimeRecording = false;
    state.currentTranscription = '';
  };

  return {
    initialize,
    transcribeFile,
    startRealtimeTranscription,
    stopRealtimeTranscription,
    subscribeToPartialResults,
    subscribeToAudioLevel,
    dispose,
    get isInitialized() {
      return state.isInitialized;
    },
    get isTranscribing() {
      return state.isTranscribing;
    },
    get initializationStatus() {
      return state.initializationStatus;
    },
  };
};

export const whisperService = createWhisperService();
export default whisperService;
