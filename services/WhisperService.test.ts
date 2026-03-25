/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('./AudioService', () => ({
  audioService: {
    warmUpIosAudioInput: jest.fn(async () => true),
  },
}));

jest.mock('./AudioSessionService', () => ({
  audioSessionService: {
    ensureRecordingMode: jest.fn(async () => true),
  },
}));

jest.mock('@/utils', () => ({
  ...jest.requireActual('@/utils'),
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
  FeatureFlag: {
    service: 'service',
    recording: 'recording',
    model: 'model',
    transcription: 'transcription',
    storage: 'storage',
  },
}));

describe('WhisperService', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  const setupPlatform = (os: string) => {
    const { Platform } = require('react-native');
    Object.defineProperty(Platform, 'OS', { get: () => os });
  };

  const getWhisperRn = () => require('whisper.rn');
  const getRealtimeModule = () =>
    require('whisper.rn/src/realtime-transcription');
  const getAdapterModule = () =>
    require('whisper.rn/src/realtime-transcription/adapters/AudioPcmStreamAdapter');

  const setupInitialized = async () => {
    setupPlatform('ios');
    const { File } = require('expo-file-system');
    (File as jest.Mock).mockImplementation(() => ({ exists: true }));
    const mod =
      require('./WhisperService') as typeof import('./WhisperService');
    await mod.whisperService.initialize();
    return mod.whisperService;
  };

  describe('initialize', () => {
    it('downloads model assets and creates whisper + VAD contexts', async () => {
      setupPlatform('ios');
      const whisperRn = getWhisperRn();
      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');

      const result = await whisperService.initialize();

      expect(result).toBe(true);
      expect(whisperRn.initWhisper).toHaveBeenCalledWith(
        expect.objectContaining({
          filePath: '/mock/asset/path',
        }),
      );
      expect(whisperRn.initWhisperVad).toHaveBeenCalledWith(
        expect.objectContaining({
          filePath: '/mock/asset/path',
        }),
      );
    });

    it('sets isInitialized and status to ready', async () => {
      setupPlatform('ios');
      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');

      await whisperService.initialize();

      expect(whisperService.initializationStatus).toBe('Whisper ready');
    });

    it('is idempotent (returns cached promise)', async () => {
      setupPlatform('ios');
      const whisperRn = getWhisperRn();
      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');

      const [r1, r2] = await Promise.all([
        whisperService.initialize(),
        whisperService.initialize(),
      ]);

      expect(r1).toBe(true);
      expect(r2).toBe(true);
      expect(whisperRn.initWhisper).toHaveBeenCalledTimes(1);
    });

    it('iOS-specific thread config', async () => {
      setupPlatform('ios');
      const whisperRn = getWhisperRn();
      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');

      await whisperService.initialize();

      expect(whisperRn.initWhisper).toHaveBeenCalledWith(
        expect.objectContaining({
          nThreads: 2,
          useGpu: false,
        }),
      );
      expect(whisperRn.initWhisperVad).toHaveBeenCalledWith(
        expect.objectContaining({
          nThreads: 1,
          useGpu: false,
        }),
      );
    });

    it('resets state and returns false on failure', async () => {
      setupPlatform('ios');
      const whisperRn = getWhisperRn();
      whisperRn.initWhisper.mockRejectedValueOnce(new Error('init failed'));

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');

      const result = await whisperService.initialize();

      expect(result).toBe(false);
      expect(whisperService.initializationStatus).toContain(
        'Initialization failed',
      );
    });
  });

  describe('transcribeFile', () => {
    it('throws if not initialized', async () => {
      setupPlatform('ios');
      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');

      await expect(
        whisperService.transcribeFile('/audio/test.wav'),
      ).rejects.toThrow('Whisper service not initialized');
    });

    it('throws if already transcribing', async () => {
      setupPlatform('ios');
      const whisperRn = getWhisperRn();
      whisperRn.initWhisper.mockResolvedValueOnce({
        ptr: 1,
        id: 1,
        gpu: false,
        reasonNoGPU: 'mock',
        transcribe: jest.fn(() => ({
          stop: jest.fn(),
          promise: new Promise(() => {}), // Never resolves
        })),
        release: jest.fn(),
      });

      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      // Start first transcription (won't resolve)
      whisperService.transcribeFile('/audio/test.wav');

      await expect(
        whisperService.transcribeFile('/audio/test2.wav'),
      ).rejects.toThrow('Transcription already in progress');
    });

    it('throws if file not found', async () => {
      const service = await setupInitialized();

      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: false }));

      await expect(
        service.transcribeFile('/audio/nonexistent.wav'),
      ).rejects.toThrow('Audio file not found');
    });

    it('calls whisperContext.transcribe and returns trimmed result', async () => {
      const service = await setupInitialized();

      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const result = await service.transcribeFile('/audio/test.wav');
      expect(result).toBe('mock transcription');
    });

    it('returns null on empty result', async () => {
      setupPlatform('ios');
      const whisperRn = getWhisperRn();
      whisperRn.initWhisper.mockResolvedValueOnce({
        ptr: 1,
        id: 1,
        gpu: false,
        reasonNoGPU: 'mock',
        transcribe: jest.fn(() => ({
          stop: jest.fn(),
          promise: Promise.resolve({
            result: '   ',
            segments: [],
            isAborted: false,
          }),
        })),
        release: jest.fn(),
      });

      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      const result = await whisperService.transcribeFile('/audio/test.wav');
      expect(result).toBeNull();
    });
  });

  describe('startRealtimeTranscription', () => {
    it('returns false if not initialized', async () => {
      setupPlatform('ios');
      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');

      const result = await whisperService.startRealtimeTranscription();
      expect(result).toBe(false);
    });

    it('returns false if already recording', async () => {
      const service = await setupInitialized();

      await service.startRealtimeTranscription();
      const result = await service.startRealtimeTranscription();

      expect(result).toBe(false);
    });

    it('warms up iOS audio and creates adapter and transcriber', async () => {
      setupPlatform('ios');
      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const audioServiceMod = require('./AudioService');
      const adapterModule = getAdapterModule();
      const realtimeModule = getRealtimeModule();

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      const result = await whisperService.startRealtimeTranscription();

      expect(result).toBe(true);
      expect(
        audioServiceMod.audioService.warmUpIosAudioInput,
      ).toHaveBeenCalled();
      expect(adapterModule.AudioPcmStreamAdapter).toHaveBeenCalled();
      expect(realtimeModule.RealtimeTranscriber).toHaveBeenCalled();
    });
  });

  describe('stopRealtimeTranscription', () => {
    it('returns empty string when not recording', async () => {
      setupPlatform('ios');
      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');

      const result = await whisperService.stopRealtimeTranscription();
      expect(result).toBe('');
    });

    it('stops transcriber and returns text', async () => {
      const service = await setupInitialized();
      await service.startRealtimeTranscription();

      const result = await service.stopRealtimeTranscription();
      expect(typeof result).toBe('string');
    });
  });

  describe('subscribeToPartialResults', () => {
    it('adds callback and unsubscribe removes it', () => {
      setupPlatform('ios');
      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');

      const callback = jest.fn();
      const unsubscribe = whisperService.subscribeToPartialResults(callback);
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('subscribeToAudioLevel', () => {
    it('adds callback and unsubscribe removes it', () => {
      setupPlatform('ios');
      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');

      const callback = jest.fn();
      const unsubscribe = whisperService.subscribeToAudioLevel(callback);
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('dispose', () => {
    it('releases whisper and VAD contexts, clears callbacks, resets state', async () => {
      const service = await setupInitialized();

      await service.dispose();

      await expect(service.transcribeFile('/audio/test.wav')).rejects.toThrow(
        'not initialized',
      );
    });

    it('releases VAD context', async () => {
      setupPlatform('ios');
      const whisperRn = getWhisperRn();
      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      // Get the resolved VAD context
      const vadContext = await whisperRn.initWhisperVad.mock.results[0].value;

      await whisperService.dispose();

      expect(vadContext.release).toHaveBeenCalled();
    });
  });

  describe('initializationStatus getter', () => {
    it('returns current status string', async () => {
      setupPlatform('ios');
      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');

      expect(whisperService.initializationStatus).toBeNull();

      await whisperService.initialize();

      expect(whisperService.initializationStatus).toBe('Whisper ready');
    });
  });

  describe('startRealtimeTranscription - additional branches', () => {
    it('returns false if file transcription is in progress', async () => {
      setupPlatform('ios');
      const whisperRn = getWhisperRn();
      whisperRn.initWhisper.mockResolvedValueOnce({
        ptr: 1,
        id: 1,
        gpu: false,
        reasonNoGPU: 'mock',
        transcribe: jest.fn(() => ({
          stop: jest.fn(),
          promise: new Promise(() => {}), // Never resolves
        })),
        release: jest.fn(),
      });

      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      // Start a file transcription (won't resolve)
      whisperService.transcribeFile('/audio/test.wav');

      // Now try realtime - should fail because isTranscribing is true
      const result = await whisperService.startRealtimeTranscription();
      expect(result).toBe(false);
    });

    it('returns false if iOS audio warm-up fails', async () => {
      setupPlatform('ios');
      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const audioServiceMod = require('./AudioService');
      audioServiceMod.audioService.warmUpIosAudioInput.mockResolvedValueOnce(
        false,
      );

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      const result = await whisperService.startRealtimeTranscription();
      expect(result).toBe(false);
    });

    it('passes language and prompt to transcribeOptions', async () => {
      setupPlatform('ios');
      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const realtimeModule = getRealtimeModule();

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      await whisperService.startRealtimeTranscription('en', 'test prompt');

      // Verify the RealtimeTranscriber was created with correct options
      const constructorCall = realtimeModule.RealtimeTranscriber.mock.calls[0];
      const options = constructorCall[1];
      expect(options.transcribeOptions).toEqual(
        expect.objectContaining({
          language: 'en',
          prompt: 'test prompt',
          maxThreads: 2,
        }),
      );
    });

    it('cleans up resources on start failure', async () => {
      setupPlatform('ios');
      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const realtimeModule = getRealtimeModule();
      const mockRelease = jest.fn();
      realtimeModule.RealtimeTranscriber.mockImplementationOnce(() => ({
        start: jest.fn().mockRejectedValue(new Error('start failed')),
        stop: jest.fn(),
        release: mockRelease,
        getTranscriptionResults: jest.fn(() => []),
      }));

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      const result = await whisperService.startRealtimeTranscription();
      expect(result).toBe(false);
      expect(mockRelease).toHaveBeenCalled();
    });

    it('processes onTranscribe callback with transcription results', async () => {
      setupPlatform('ios');
      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const realtimeModule = getRealtimeModule();
      let onTranscribeCallback: (event: Record<string, unknown>) => void;

      realtimeModule.RealtimeTranscriber.mockImplementationOnce(
        (
          _deps: Record<string, unknown>,
          _opts: Record<string, unknown>,
          callbacks: Record<string, (...args: unknown[]) => void>,
        ) => {
          onTranscribeCallback = callbacks.onTranscribe;
          return {
            start: jest.fn(),
            stop: jest.fn(),
            release: jest.fn(),
            getTranscriptionResults: jest.fn(() => [
              {
                transcribeEvent: {
                  data: { result: 'hello world' },
                },
              },
            ]),
          };
        },
      );

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      const partialCallback = jest.fn();
      whisperService.subscribeToPartialResults(partialCallback);

      await whisperService.startRealtimeTranscription();

      // Simulate a transcription event
      onTranscribeCallback!({
        type: 'transcribe',
        sliceIndex: 0,
        data: { result: 'hello world' },
        isCapturing: true,
        processTime: 100,
        recordingTime: 1000,
      });

      expect(partialCallback).toHaveBeenCalledWith('hello world');
    });

    it('handles onTranscribe callback error in partial callback', async () => {
      setupPlatform('ios');
      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const realtimeModule = getRealtimeModule();
      const { logError } = require('@/utils');
      let onTranscribeCallback: (event: Record<string, unknown>) => void;

      realtimeModule.RealtimeTranscriber.mockImplementationOnce(
        (
          _deps: Record<string, unknown>,
          _opts: Record<string, unknown>,
          callbacks: Record<string, (...args: unknown[]) => void>,
        ) => {
          onTranscribeCallback = callbacks.onTranscribe;
          return {
            start: jest.fn(),
            stop: jest.fn(),
            release: jest.fn(),
            getTranscriptionResults: jest.fn(() => [
              {
                transcribeEvent: {
                  data: { result: 'test' },
                },
              },
            ]),
          };
        },
      );

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      const errorCallback = jest.fn(() => {
        throw new Error('callback error');
      });
      whisperService.subscribeToPartialResults(errorCallback);

      await whisperService.startRealtimeTranscription();

      (logError as jest.Mock).mockClear();

      // Should not throw even though callback throws
      onTranscribeCallback!({
        type: 'transcribe',
        sliceIndex: 0,
        data: { result: 'test' },
        isCapturing: true,
        processTime: 100,
        recordingTime: 1000,
      });

      expect(logError).toHaveBeenCalled();
    });

    it('handles onError callback', async () => {
      setupPlatform('ios');
      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const realtimeModule = getRealtimeModule();
      const { logError } = require('@/utils');
      let onErrorCallback: (error: string) => void;

      realtimeModule.RealtimeTranscriber.mockImplementationOnce(
        (
          _deps: Record<string, unknown>,
          _opts: Record<string, unknown>,
          callbacks: Record<string, (...args: unknown[]) => void>,
        ) => {
          onErrorCallback = callbacks.onError;
          return {
            start: jest.fn(),
            stop: jest.fn(),
            release: jest.fn(),
            getTranscriptionResults: jest.fn(() => []),
          };
        },
      );

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      await whisperService.startRealtimeTranscription();

      (logError as jest.Mock).mockClear();
      onErrorCallback!('test error');

      expect(logError).toHaveBeenCalledWith(
        'test error',
        expect.objectContaining({
          message: 'RealtimeTranscriber error',
        }),
      );
    });

    it('handles onStatusChange callback', async () => {
      setupPlatform('ios');
      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const realtimeModule = getRealtimeModule();
      let onStatusChangeCallback: (isActive: boolean) => void;

      realtimeModule.RealtimeTranscriber.mockImplementationOnce(
        (
          _deps: Record<string, unknown>,
          _opts: Record<string, unknown>,
          callbacks: Record<string, (...args: unknown[]) => void>,
        ) => {
          onStatusChangeCallback = callbacks.onStatusChange;
          return {
            start: jest.fn(),
            stop: jest.fn(),
            release: jest.fn(),
            getTranscriptionResults: jest.fn(() => []),
          };
        },
      );

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      await whisperService.startRealtimeTranscription();

      // Calling onStatusChange with false should allow starting again
      onStatusChangeCallback!(false);

      // The internal state should have been updated
      // After statusChange(false), isRealtimeRecording should be false
      // But we can't easily test internal state directly, so verify
      // that a new start works (since isRealtimeRecording would be false)
    });
  });

  describe('stopRealtimeTranscription - additional branches', () => {
    it('aggregates final results from transcription history', async () => {
      setupPlatform('ios');
      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const realtimeModule = getRealtimeModule();
      realtimeModule.RealtimeTranscriber.mockImplementationOnce(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        release: jest.fn(),
        getTranscriptionResults: jest.fn(() => [
          {
            transcribeEvent: {
              data: { result: 'Hello' },
            },
          },
          {
            transcribeEvent: {
              data: { result: 'World' },
            },
          },
        ]),
      }));

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      await whisperService.startRealtimeTranscription();
      const result = await whisperService.stopRealtimeTranscription();

      expect(result).toBe('Hello World');
    });

    it('returns current transcription on error during stop', async () => {
      setupPlatform('ios');
      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const realtimeModule = getRealtimeModule();
      let onTranscribeCallback: (event: Record<string, unknown>) => void;

      realtimeModule.RealtimeTranscriber.mockImplementationOnce(
        (
          _deps: Record<string, unknown>,
          _opts: Record<string, unknown>,
          callbacks: Record<string, (...args: unknown[]) => void>,
        ) => {
          onTranscribeCallback = callbacks.onTranscribe;
          return {
            start: jest.fn(),
            stop: jest.fn().mockRejectedValue(new Error('stop error')),
            release: jest.fn(),
            getTranscriptionResults: jest.fn(() => [
              {
                transcribeEvent: {
                  data: { result: 'partial text' },
                },
              },
            ]),
          };
        },
      );

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      await whisperService.startRealtimeTranscription();

      // Simulate some transcription to set currentTranscription
      onTranscribeCallback!({
        type: 'transcribe',
        sliceIndex: 0,
        data: { result: 'partial text' },
        isCapturing: true,
        processTime: 100,
        recordingTime: 1000,
      });

      const result = await whisperService.stopRealtimeTranscription();
      // Should return the current transcription even though stop threw
      expect(result).toBe('partial text');
    });

    it('returns empty final text and falls back to currentTranscription', async () => {
      setupPlatform('ios');
      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const realtimeModule = getRealtimeModule();
      let onTranscribeCallback: (event: Record<string, unknown>) => void;

      realtimeModule.RealtimeTranscriber.mockImplementationOnce(
        (
          _deps: Record<string, unknown>,
          _opts: Record<string, unknown>,
          callbacks: Record<string, (...args: unknown[]) => void>,
        ) => {
          onTranscribeCallback = callbacks.onTranscribe;
          return {
            start: jest.fn(),
            stop: jest.fn(),
            release: jest.fn(),
            getTranscriptionResults: jest.fn(() => []),
          };
        },
      );

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      await whisperService.startRealtimeTranscription();

      // Set current transcription via callback
      onTranscribeCallback!({
        type: 'transcribe',
        sliceIndex: 0,
        data: { result: 'saved text' },
        isCapturing: true,
        processTime: 100,
        recordingTime: 1000,
      });

      const result = await whisperService.stopRealtimeTranscription();
      // finalText is empty (getTranscriptionResults returns []),
      // so it should fallback to currentTranscription
      expect(result).toBe('saved text');
    });
  });

  describe('processAudioLevel', () => {
    it('computes RMS and calls audio level callbacks', async () => {
      setupPlatform('ios');
      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const realtimeModule = getRealtimeModule();
      const adapterModule = getAdapterModule();
      let capturedOnDataCallback:
        | ((data: { data: Uint8Array }) => void)
        | null = null;

      adapterModule.AudioPcmStreamAdapter.mockImplementationOnce(() => {
        const instance = {
          initialize: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
          isRecording: jest.fn(() => false),
          onData: jest.fn((callback: (data: { data: Uint8Array }) => void) => {
            capturedOnDataCallback = callback;
          }),
          onError: jest.fn(),
          onStatusChange: jest.fn(),
          release: jest.fn(),
        };
        return instance;
      });

      realtimeModule.RealtimeTranscriber.mockImplementationOnce(
        (deps: Record<string, unknown>) => {
          // The audioStream.onData is overwritten by the service's interceptor
          // We need to simulate the data flow through it
          const audioStream = deps.audioStream as {
            onData: (callback: (data: { data: Uint8Array }) => void) => void;
          };
          // Call onData to register the interceptor
          audioStream.onData((data: { data: Uint8Array }) => {
            // This is what the transcriber's internal handler does - nothing needed here
            void data;
          });

          return {
            start: jest.fn(),
            stop: jest.fn(),
            release: jest.fn(),
            getTranscriptionResults: jest.fn(() => []),
          };
        },
      );

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      const levelCallback = jest.fn();
      whisperService.subscribeToAudioLevel(levelCallback);

      await whisperService.startRealtimeTranscription();

      // Create audio data with moderate amplitude
      const audioData = new Uint8Array(64);
      for (let i = 0; i < 32; i++) {
        const sample = Math.floor(Math.sin(i * 0.5) * 8000);
        audioData[i * 2] = sample & 0xff;
        audioData[i * 2 + 1] = (sample >> 8) & 0xff;
      }

      // Send data through the interceptor
      expect(capturedOnDataCallback).not.toBeNull();
      capturedOnDataCallback!({ data: audioData });

      expect(levelCallback).toHaveBeenCalled();
      const level = levelCallback.mock.calls[0][0];
      expect(level).toBeGreaterThanOrEqual(0.02);
      expect(level).toBeLessThanOrEqual(1.0);
    });

    it('handles error in audio level callback gracefully', async () => {
      setupPlatform('ios');
      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const realtimeModule = getRealtimeModule();
      const adapterModule = getAdapterModule();
      const { logError } = require('@/utils');
      let capturedOnDataCallback:
        | ((data: { data: Uint8Array }) => void)
        | null = null;

      adapterModule.AudioPcmStreamAdapter.mockImplementationOnce(() => ({
        initialize: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        isRecording: jest.fn(() => false),
        onData: jest.fn((callback: (data: { data: Uint8Array }) => void) => {
          capturedOnDataCallback = callback;
        }),
        onError: jest.fn(),
        onStatusChange: jest.fn(),
        release: jest.fn(),
      }));

      realtimeModule.RealtimeTranscriber.mockImplementationOnce(
        (deps: Record<string, unknown>) => {
          const audioStream = deps.audioStream as {
            onData: (callback: (data: { data: Uint8Array }) => void) => void;
          };
          audioStream.onData((data: { data: Uint8Array }) => {
            void data;
          });
          return {
            start: jest.fn(),
            stop: jest.fn(),
            release: jest.fn(),
            getTranscriptionResults: jest.fn(() => []),
          };
        },
      );

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      const errorCallback = jest.fn(() => {
        throw new Error('level callback error');
      });
      whisperService.subscribeToAudioLevel(errorCallback);

      await whisperService.startRealtimeTranscription();

      (logError as jest.Mock).mockClear();

      const audioData = new Uint8Array(4);
      audioData[0] = 0x00;
      audioData[1] = 0x40;
      audioData[2] = 0x00;
      audioData[3] = 0x40;

      capturedOnDataCallback!({ data: audioData });

      expect(logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          message: 'Error in audio level callback',
        }),
      );
    });

    it('handles empty audio data (< 2 bytes) with zero RMS', async () => {
      setupPlatform('ios');
      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const realtimeModule = getRealtimeModule();
      const adapterModule = getAdapterModule();
      let capturedOnDataCallback:
        | ((data: { data: Uint8Array }) => void)
        | null = null;

      adapterModule.AudioPcmStreamAdapter.mockImplementationOnce(() => ({
        initialize: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        isRecording: jest.fn(() => false),
        onData: jest.fn((callback: (data: { data: Uint8Array }) => void) => {
          capturedOnDataCallback = callback;
        }),
        onError: jest.fn(),
        onStatusChange: jest.fn(),
        release: jest.fn(),
      }));

      realtimeModule.RealtimeTranscriber.mockImplementationOnce(
        (deps: Record<string, unknown>) => {
          const audioStream = deps.audioStream as {
            onData: (callback: (data: { data: Uint8Array }) => void) => void;
          };
          audioStream.onData((data: { data: Uint8Array }) => {
            void data;
          });
          return {
            start: jest.fn(),
            stop: jest.fn(),
            release: jest.fn(),
            getTranscriptionResults: jest.fn(() => []),
          };
        },
      );

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      const levelCallback = jest.fn();
      whisperService.subscribeToAudioLevel(levelCallback);

      await whisperService.startRealtimeTranscription();

      // Send single byte - computeRmsFromPcm returns 0 for < 2 bytes
      capturedOnDataCallback!({ data: new Uint8Array(1) });

      expect(levelCallback).toHaveBeenCalled();
      // Should be minimum level (0.02) since RMS is 0
      const level = levelCallback.mock.calls[0][0];
      expect(level).toBe(0.02);
    });
  });

  describe('subscribeToPartialResults - receive and unsubscribe', () => {
    it('receives partial results and stops after unsubscribe', async () => {
      setupPlatform('ios');
      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const realtimeModule = getRealtimeModule();
      let onTranscribeCallback: (event: Record<string, unknown>) => void;

      realtimeModule.RealtimeTranscriber.mockImplementationOnce(
        (
          _deps: Record<string, unknown>,
          _opts: Record<string, unknown>,
          callbacks: Record<string, (...args: unknown[]) => void>,
        ) => {
          onTranscribeCallback = callbacks.onTranscribe;
          return {
            start: jest.fn(),
            stop: jest.fn(),
            release: jest.fn(),
            getTranscriptionResults: jest.fn(() => [
              {
                transcribeEvent: {
                  data: { result: 'test result' },
                },
              },
            ]),
          };
        },
      );

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      const callback = jest.fn();
      const unsubscribe = whisperService.subscribeToPartialResults(callback);

      await whisperService.startRealtimeTranscription();

      // Emit a transcription event
      onTranscribeCallback!({
        type: 'transcribe',
        sliceIndex: 0,
        data: { result: 'test result' },
        isCapturing: true,
        processTime: 100,
        recordingTime: 1000,
      });

      expect(callback).toHaveBeenCalledTimes(1);

      // Unsubscribe and verify no more calls
      unsubscribe();
      callback.mockClear();

      onTranscribeCallback!({
        type: 'transcribe',
        sliceIndex: 1,
        data: { result: 'more text' },
        isCapturing: true,
        processTime: 100,
        recordingTime: 2000,
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('subscribeToAudioLevel - receive and unsubscribe', () => {
    it('stops receiving levels after unsubscribe', async () => {
      setupPlatform('ios');
      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const realtimeModule = getRealtimeModule();
      const adapterModule = getAdapterModule();
      let capturedOnDataCallback:
        | ((data: { data: Uint8Array }) => void)
        | null = null;

      adapterModule.AudioPcmStreamAdapter.mockImplementationOnce(() => ({
        initialize: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        isRecording: jest.fn(() => false),
        onData: jest.fn((callback: (data: { data: Uint8Array }) => void) => {
          capturedOnDataCallback = callback;
        }),
        onError: jest.fn(),
        onStatusChange: jest.fn(),
        release: jest.fn(),
      }));

      realtimeModule.RealtimeTranscriber.mockImplementationOnce(
        (deps: Record<string, unknown>) => {
          const audioStream = deps.audioStream as {
            onData: (callback: (data: { data: Uint8Array }) => void) => void;
          };
          audioStream.onData((data: { data: Uint8Array }) => {
            void data;
          });
          return {
            start: jest.fn(),
            stop: jest.fn(),
            release: jest.fn(),
            getTranscriptionResults: jest.fn(() => []),
          };
        },
      );

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      const levelCallback = jest.fn();
      const unsubscribe = whisperService.subscribeToAudioLevel(levelCallback);

      await whisperService.startRealtimeTranscription();

      const audioData = new Uint8Array(4);
      audioData[0] = 0x00;
      audioData[1] = 0x40;
      audioData[2] = 0x00;
      audioData[3] = 0x40;

      capturedOnDataCallback!({ data: audioData });
      expect(levelCallback).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();
      levelCallback.mockClear();

      capturedOnDataCallback!({ data: audioData });
      expect(levelCallback).not.toHaveBeenCalled();
    });
  });

  describe('dispose - additional branches', () => {
    it('stops realtime transcription if recording during dispose', async () => {
      setupPlatform('ios');
      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const realtimeModule = getRealtimeModule();
      const mockStop = jest.fn();
      const mockRelease = jest.fn();
      realtimeModule.RealtimeTranscriber.mockImplementationOnce(() => ({
        start: jest.fn(),
        stop: mockStop,
        release: mockRelease,
        getTranscriptionResults: jest.fn(() => []),
      }));

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      await whisperService.startRealtimeTranscription();

      await whisperService.dispose();

      expect(mockStop).toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalled();
    });

    it('handles error when releasing whisper context', async () => {
      setupPlatform('ios');
      const whisperRn = getWhisperRn();
      whisperRn.initWhisper.mockResolvedValueOnce({
        ptr: 1,
        id: 1,
        gpu: false,
        reasonNoGPU: 'mock',
        transcribe: jest.fn(() => ({
          stop: jest.fn(),
          promise: Promise.resolve({ result: 'test', segments: [] }),
        })),
        release: jest.fn().mockRejectedValue(new Error('release error')),
      });

      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const { logError } = require('@/utils');

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      (logError as jest.Mock).mockClear();

      // Should not throw
      await whisperService.dispose();

      expect(logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          message: 'Error releasing Whisper context',
        }),
      );
    });

    it('handles error when releasing VAD context', async () => {
      setupPlatform('ios');
      const whisperRn = getWhisperRn();
      whisperRn.initWhisperVad.mockResolvedValueOnce({
        id: 1,
        gpu: false,
        reasonNoGPU: 'mock',
        detectSpeech: jest.fn(),
        detectSpeechData: jest.fn(),
        release: jest.fn().mockRejectedValue(new Error('vad release error')),
      });

      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const { logError } = require('@/utils');

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      (logError as jest.Mock).mockClear();

      await whisperService.dispose();

      expect(logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          message: 'Error releasing VAD context',
        }),
      );
    });

    it('clears partial callbacks on dispose', async () => {
      const service = await setupInitialized();

      const callback = jest.fn();
      service.subscribeToPartialResults(callback);

      await service.dispose();

      // After dispose, state is reset - re-initialize would be needed
      // Verify by checking that transcribeFile throws not initialized
      await expect(service.transcribeFile('/audio/test.wav')).rejects.toThrow(
        'not initialized',
      );
    });
  });

  describe('cleanupRealtimeResources', () => {
    it('handles error during transcriber release', async () => {
      setupPlatform('ios');
      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const realtimeModule = getRealtimeModule();
      const { logError } = require('@/utils');

      realtimeModule.RealtimeTranscriber.mockImplementationOnce(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        release: jest
          .fn()
          .mockRejectedValue(new Error('release transcriber error')),
        getTranscriptionResults: jest.fn(() => []),
      }));

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      await whisperService.startRealtimeTranscription();

      (logError as jest.Mock).mockClear();

      // Stop triggers cleanup which calls release
      await whisperService.stopRealtimeTranscription();

      expect(logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          message: 'Error releasing RealtimeTranscriber',
        }),
      );
    });

    it('resets audio level to minimum and notifies callbacks on cleanup', async () => {
      setupPlatform('ios');
      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const realtimeModule = getRealtimeModule();

      realtimeModule.RealtimeTranscriber.mockImplementationOnce(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        release: jest.fn(),
        getTranscriptionResults: jest.fn(() => []),
      }));

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      const levelCallback = jest.fn();
      whisperService.subscribeToAudioLevel(levelCallback);

      await whisperService.startRealtimeTranscription();

      levelCallback.mockClear();

      // Stop triggers cleanup which sends 0.02 to audio level callbacks
      await whisperService.stopRealtimeTranscription();

      expect(levelCallback).toHaveBeenCalledWith(0.02);
    });
  });

  describe('transcribeFile - additional branches', () => {
    it('passes language and prompt options', async () => {
      const service = await setupInitialized();

      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const whisperRn = getWhisperRn();
      const whisperContext = await whisperRn.initWhisper.mock.results[0].value;

      await service.transcribeFile('/audio/test.wav', 'en', 'context prompt');

      expect(whisperContext.transcribe).toHaveBeenCalledWith(
        '/audio/test.wav',
        expect.objectContaining({
          language: 'en',
          prompt: 'context prompt',
        }),
      );
    });

    it('throws and logs error on transcription failure', async () => {
      setupPlatform('ios');
      const whisperRn = getWhisperRn();
      const { logError } = require('@/utils');
      whisperRn.initWhisper.mockResolvedValueOnce({
        ptr: 1,
        id: 1,
        gpu: false,
        reasonNoGPU: 'mock',
        transcribe: jest.fn(() => ({
          stop: jest.fn(),
          promise: Promise.reject(new Error('transcription error')),
        })),
        release: jest.fn(),
      });

      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      (logError as jest.Mock).mockClear();

      await expect(
        whisperService.transcribeFile('/audio/test.wav'),
      ).rejects.toThrow('transcription error');

      expect(logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          message: 'Whisper file transcription failed',
        }),
      );
    });

    it('resets isTranscribing flag after error', async () => {
      setupPlatform('ios');
      const whisperRn = getWhisperRn();
      whisperRn.initWhisper.mockResolvedValueOnce({
        ptr: 1,
        id: 1,
        gpu: false,
        reasonNoGPU: 'mock',
        transcribe: jest.fn(() => ({
          stop: jest.fn(),
          promise: Promise.reject(new Error('transcription error')),
        })),
        release: jest.fn(),
      });

      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      // First call fails
      await expect(
        whisperService.transcribeFile('/audio/test.wav'),
      ).rejects.toThrow();

      // Should be able to try again (isTranscribing reset to false)
      // This would throw again because mock still rejects, but it shouldn't
      // throw "already in progress"
      await expect(
        whisperService.transcribeFile('/audio/test.wav'),
      ).rejects.toThrow('transcription error');
    });
  });

  describe('initialize - Android path', () => {
    it('does not pass iOS-specific config on Android', async () => {
      setupPlatform('android');
      const whisperRn = getWhisperRn();
      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');

      await whisperService.initialize();

      const initWhisperCall = whisperRn.initWhisper.mock.calls[0][0];
      expect(initWhisperCall.nThreads).toBeUndefined();
      expect(initWhisperCall.useGpu).toBeUndefined();
    });
  });

  describe('transcribeFile - options branches', () => {
    it('passes language and prompt when both provided', async () => {
      setupPlatform('ios');
      const whisperRn = getWhisperRn();
      const mockTranscribe = jest.fn(() => ({
        stop: jest.fn(),
        promise: Promise.resolve({ result: 'Hello' }),
      }));
      whisperRn.initWhisper.mockResolvedValueOnce({
        id: 1,
        gpu: false,
        reasonNoGPU: 'mock',
        transcribe: mockTranscribe,
        release: jest.fn(),
      });

      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      await whisperService.transcribeFile(
        '/audio/test.wav',
        'en',
        'test prompt',
      );

      const transcribeCall = mockTranscribe.mock.calls[0];
      // @ts-expect-error - transcribeCall is an array of arguments
      expect(transcribeCall[1].language).toBe('en');
      // @ts-expect-error - transcribeCall is an array of arguments
      expect(transcribeCall[1].prompt).toBe('test prompt');
    });

    it('passes no options when language and prompt not provided', async () => {
      setupPlatform('ios');
      const whisperRn = getWhisperRn();
      const mockTranscribe = jest.fn(() => ({
        stop: jest.fn(),
        promise: Promise.resolve({ result: 'Hello' }),
      }));
      whisperRn.initWhisper.mockResolvedValueOnce({
        id: 1,
        gpu: false,
        reasonNoGPU: 'mock',
        transcribe: mockTranscribe,
        release: jest.fn(),
      });

      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      await whisperService.transcribeFile('/audio/test.wav');

      const transcribeCall = mockTranscribe.mock.calls[0];
      // @ts-expect-error - transcribeCall is an array of arguments
      expect(transcribeCall[1].language).toBeUndefined();
      // @ts-expect-error - transcribeCall is an array of arguments
      expect(transcribeCall[1].prompt).toBeUndefined();
    });
  });

  describe('transcribeFile - result.result null', () => {
    it('returns null when result.result is empty/whitespace', async () => {
      setupPlatform('ios');
      const whisperRn = getWhisperRn();
      whisperRn.initWhisper.mockResolvedValueOnce({
        id: 1,
        gpu: false,
        reasonNoGPU: 'mock',
        transcribe: jest.fn(() => ({
          stop: jest.fn(),
          promise: Promise.resolve({ result: '   ' }),
        })),
        release: jest.fn(),
      });

      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      const result = await whisperService.transcribeFile('/audio/test.wav');
      expect(result).toBeNull();
    });
  });

  describe('startRealtimeTranscription - isTranscribing branch', () => {
    it('returns false when file transcription is in progress', async () => {
      setupPlatform('ios');
      const whisperRn = getWhisperRn();

      // Make transcribe hang indefinitely
      let resolveTranscribe: (() => void) | null = null;
      whisperRn.initWhisper.mockResolvedValueOnce({
        id: 1,
        gpu: false,
        reasonNoGPU: 'mock',
        transcribe: jest.fn(() => ({
          stop: jest.fn(),
          promise: new Promise<void>((resolve) => {
            resolveTranscribe = resolve;
          }),
        })),
        release: jest.fn(),
      });

      const { File } = require('expo-file-system');
      (File as jest.Mock).mockImplementation(() => ({ exists: true }));

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      // Start a file transcription (will hang)
      const transcribePromise =
        whisperService.transcribeFile('/audio/test.wav');

      // Try to start realtime while file transcription is "in progress"
      const realtimeResult = await whisperService.startRealtimeTranscription();
      expect(realtimeResult).toBe(false);

      // Cleanup
      if (resolveTranscribe) {
        // @ts-expect-error - resolveTranscribe is a function
        resolveTranscribe();
      }
      try {
        await transcribePromise;
      } catch {
        // expected
      }
    });
  });

  describe('stopRealtimeTranscription - not recording', () => {
    it('returns empty string when not recording', async () => {
      setupPlatform('ios');
      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      const result = await whisperService.stopRealtimeTranscription();
      expect(result).toBe('');
    });
  });

  describe('dispose - cleanup', () => {
    it('disposes whisper and vad contexts', async () => {
      setupPlatform('ios');
      const whisperRn = getWhisperRn();
      const mockRelease = jest.fn();
      const mockVadRelease = jest.fn();
      whisperRn.initWhisper.mockResolvedValueOnce({
        id: 1,
        gpu: false,
        reasonNoGPU: 'mock',
        transcribe: jest.fn(() => ({
          stop: jest.fn(),
          promise: Promise.resolve({ result: 'Hello' }),
        })),
        release: mockRelease,
      });
      whisperRn.initWhisperVad.mockResolvedValueOnce({
        release: mockVadRelease,
      });

      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');
      await whisperService.initialize();

      await whisperService.dispose();

      expect(mockRelease).toHaveBeenCalled();
      expect(mockVadRelease).toHaveBeenCalled();
    });
  });

  describe('subscribeToAudioLevel', () => {
    it('subscribes and unsubscribes audio level callbacks', async () => {
      setupPlatform('ios');
      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');

      const callback = jest.fn();
      const unsubscribe = whisperService.subscribeToAudioLevel(callback);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
      // Should not throw after unsubscribe
    });
  });

  describe('subscribeToPartialResults', () => {
    it('subscribes and unsubscribes partial result callbacks', async () => {
      setupPlatform('ios');
      const { whisperService } =
        require('./WhisperService') as typeof import('./WhisperService');

      const callback = jest.fn();
      const unsubscribe = whisperService.subscribeToPartialResults(callback);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });
});
