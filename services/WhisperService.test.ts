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
});
