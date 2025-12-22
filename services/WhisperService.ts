import { Asset } from 'expo-asset';
import { setAudioModeAsync } from 'expo-audio';
import { File } from 'expo-file-system';
import RNFS from 'react-native-fs';
// @ts-ignore - whisper.rn may not have complete type declarations
import { initWhisper, initWhisperVad, type WhisperContext, type WhisperVadContext } from 'whisper.rn';
// @ts-ignore - whisper.rn may not have complete type declarations
import { RealtimeTranscriber } from 'whisper.rn/src/realtime-transcription';
// @ts-ignore - whisper.rn may not have complete type declarations
import { AudioPcmStreamAdapter } from 'whisper.rn/src/realtime-transcription/adapters/AudioPcmStreamAdapter';

import { FeatureFlag, logError, logWarn } from '@/utils';

const AUDIO_LEVEL_THROTTLE_MS = 33;
const RMS_SAMPLE_STEP = 4;

interface RealtimeTranscribeEvent {
  type: 'error' | 'start' | 'transcribe' | 'end';
  sliceIndex: number;
  data?: { result: string };
  isCapturing: boolean;
  processTime: number;
  recordingTime: number;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const modelAsset = require('@/assets/models/whisper/ggml-tiny.bin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vadModelAsset = require('@/assets/models/whisper/ggml-silero-v6.2.0.bin');

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
  lastAudioLevelEmitTime: number;
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
    lastAudioLevelEmitTime: 0,
  };

  const computeRmsLevel = (data: Uint8Array): number => {
    if (data.length === 0) return 0;

    let sumSquares = 0;
    let sampleCount = 0;
    const step = RMS_SAMPLE_STEP * 2;

    for (let i = 0; i < data.length - 1; i += step) {
      const low = data[i];
      const high = data[i + 1];
      let sample = low | (high << 8);
      if (sample >= 32768) {
        sample -= 65536;
      }
      const normalized = sample / 32768;
      sumSquares += normalized * normalized;
      sampleCount++;
    }

    if (sampleCount === 0) return 0;
    const rms = Math.sqrt(sumSquares / sampleCount);
    const boosted = Math.min(1.0, rms * 8);
    const level = Math.pow(boosted, 0.7);
    return level;
  };

  const emitAudioLevel = (level: number): void => {
    const now = Date.now();
    if (now - state.lastAudioLevelEmitTime < AUDIO_LEVEL_THROTTLE_MS) {
      return;
    }
    state.lastAudioLevelEmitTime = now;

    const visual = Math.max(0.02, Math.min(1.0, level));
    state.audioLevelCallbacks.forEach((callback) => {
      try {
        callback(visual);
      } catch (error) {
        logError(error, { flag: FeatureFlag.transcription, message: 'Error in audio level callback' });
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
      await configureAudioSession(100);

      const modelPath = await prepareModel();

      state.initializationStatus = 'Initializing Whisper context...';

      state.whisperContext = await initWhisper({
        filePath: modelPath,
      });

      const vadModelPath = await prepareVadModel();

      state.initializationStatus = 'Initializing VAD context...';

      state.vadContext = await initWhisperVad({
        filePath: vadModelPath,
      });

      state.isInitialized = true;
      state.initializationStatus = 'Whisper ready';
      return true;
    } catch (error) {
      state.initializationStatus = `Initialization failed: ${error}`;
      logError(error, { flag: FeatureFlag.model, message: 'Whisper initialization failed' });
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
      logError(error, { flag: FeatureFlag.transcription, message: 'Whisper file transcription failed' });
      throw error;
    } finally {
      state.isTranscribing = false;
    }
  };

  const startRealtimeTranscription = async (
    languageCode?: string
  ): Promise<boolean> => {
    if (!state.isInitialized || !state.whisperContext || !state.vadContext) {
      logError('Cannot start real-time: Whisper or VAD not initialized', { flag: FeatureFlag.transcription });
      return false;
    }

    if (state.isRealtimeRecording) {
      logError('Real-time transcription already in progress', { flag: FeatureFlag.transcription });
      return false;
    }

    if (state.isTranscribing) {
      logError('Cannot start real-time: file transcription in progress', { flag: FeatureFlag.transcription });
      return false;
    }

    try {
      state.currentTranscription = '';

      await configureAudioSession(100);

      const audioStream = new AudioPcmStreamAdapter();
      state.realtimeAudioStream = audioStream;

      // Wrap the audioStream to intercept audio data for level metering
      // RealtimeTranscriber will overwrite onData, so we need to intercept at a lower level
      const originalOnData = audioStream.onData.bind(audioStream);
      let transcriberDataCallback: ((data: { data: Uint8Array }) => void) | undefined;
      
      audioStream.onData = (callback: (data: { data: Uint8Array }) => void) => {
        transcriberDataCallback = callback;
        originalOnData((audioData: { data: Uint8Array }) => {
          if (audioData.data) {
            const level = computeRmsLevel(audioData.data);
            emitAudioLevel(level);
          }
          if (transcriberDataCallback) {
            transcriberDataCallback(audioData);
          }
        });
      };

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
                    logError(error, { flag: FeatureFlag.transcription, message: 'Error in partial callback' });
                  }
                });
              }
            } catch (error) {
              logError(error, { flag: FeatureFlag.transcription, message: 'Error handling transcription event' });
            }
          },
          onError: (error: string) => {
            logError(error, { flag: FeatureFlag.transcription, message: 'RealtimeTranscriber error' });
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
      logError(error, { flag: FeatureFlag.transcription, message: 'Error starting real-time recording' });
      cleanupRealtimeResources();
      state.isRealtimeRecording = false;
      return false;
    }
  };

  const stopRealtimeTranscription = async (): Promise<string> => {
    if (!state.isRealtimeRecording || !state.realtimeTranscriber) {
      logWarn('No real-time transcription in progress', { flag: FeatureFlag.transcription });
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
      logError(error, { flag: FeatureFlag.transcription, message: 'Failed to stop real-time recording' });
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
        logError(error, { flag: FeatureFlag.transcription, message: 'Error releasing RealtimeTranscriber' });
      }
    }

    state.realtimeTranscriber = null;
    state.realtimeAudioStream = null;
    state.isRealtimeRecording = false;
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
        logError(error, { flag: FeatureFlag.model, message: 'Error releasing VAD context' });
      }
    }

    if (state.whisperContext) {
      try {
        await state.whisperContext.release();
      } catch (error) {
        logError(error, { flag: FeatureFlag.model, message: 'Error releasing Whisper context' });
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
    state.lastAudioLevelEmitTime = 0;
  };

  return {
    initialize,
    transcribeFile,
    startRealtimeTranscription,
    stopRealtimeTranscription,
    subscribeToPartialResults,
    subscribeToAudioLevel,
    dispose,
    get initializationStatus() {
      return state.initializationStatus;
    },
  };
};

export const whisperService = createWhisperService();
export default whisperService;
