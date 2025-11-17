import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
// @ts-ignore - whisper.rn may not have complete type declarations
import { initWhisper, type TranscribeRealtimeEvent, type WhisperContext } from 'whisper.rn';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const modelAsset = require('../assets/models/whisper/ggml-tiny.bin');

interface WhisperServiceState {
  whisperContext: WhisperContext | null;
  isInitialized: boolean;
  isInitializing: boolean;
  isTranscribing: boolean;
  isRealtimeRecording: boolean;
  currentTranscription: string;
  initializationStatus: string | null;
  realtimeStop: (() => Promise<void>) | null;
  realtimeUnsubscribe: (() => void) | null;
  partialCallbacks: Set<(text: string) => void>;
}

const createWhisperService = () => {
  const state: WhisperServiceState = {
    whisperContext: null,
    isInitialized: false,
    isInitializing: false,
    isTranscribing: false,
    isRealtimeRecording: false,
    currentTranscription: '',
    initializationStatus: null,
    realtimeStop: null,
    realtimeUnsubscribe: null,
    partialCallbacks: new Set(),
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
      const modelPath = await prepareModel();

      state.initializationStatus = 'Initializing Whisper context...';

      state.whisperContext = await initWhisper({
        filePath: modelPath,
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
    if (!state.isInitialized || !state.whisperContext) {
      console.error('Cannot start real-time: Whisper not initialized');
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

      const options = {
        language: languageCode,
        realtimeAudioSec: 30,
      };

      const { stop, subscribe } = await state.whisperContext.transcribeRealtime(
        options
      );

      const unsubscribe = subscribe((event: TranscribeRealtimeEvent) => {
        try {
          if (event.isCapturing && event.data?.result) {
            const text = event.data.result.trim();
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
      });

      state.realtimeStop = stop;
      state.realtimeUnsubscribe = unsubscribe;
      state.isRealtimeRecording = true;

      return true;
    } catch (error) {
      console.error('Error starting real-time recording:', error);
      state.isRealtimeRecording = false;
      return false;
    }
  };

  const stopRealtimeTranscription = async (): Promise<string> => {
    if (!state.isRealtimeRecording) {
      console.warn('No real-time transcription in progress');
      return '';
    }

    try {
      if (state.realtimeStop) {
        await state.realtimeStop();
      }

      return state.currentTranscription;
    } catch (error) {
      console.error('Failed to stop real-time recording:', error);
      return state.currentTranscription;
    } finally {
      if (state.realtimeUnsubscribe) {
        state.realtimeUnsubscribe();
      }
      state.isRealtimeRecording = false;
      state.realtimeStop = null;
      state.realtimeUnsubscribe = null;
    }
  };

  const subscribeToPartialResults = (
    callback: (text: string) => void
  ): (() => void) => {
    state.partialCallbacks.add(callback);

    return () => {
      state.partialCallbacks.delete(callback);
    };
  };

  const dispose = async (): Promise<void> => {
    if (state.isRealtimeRecording) {
      await stopRealtimeTranscription();
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
    state.isInitialized = false;
    state.isInitializing = false;
    state.isTranscribing = false;
    state.isRealtimeRecording = false;
    state.currentTranscription = '';
    state.realtimeStop = null;
    state.realtimeUnsubscribe = null;
  };

  return {
    initialize,
    transcribeFile,
    startRealtimeTranscription,
    stopRealtimeTranscription,
    subscribeToPartialResults,
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
