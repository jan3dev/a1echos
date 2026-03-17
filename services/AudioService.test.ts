/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock("./PermissionService", () => ({
  permissionService: {
    ensureRecordPermission: jest.fn(async () => true),
  },
}));

jest.mock("@/utils", () => ({
  ...jest.requireActual("@/utils"),
  createPcmStreamWriter: jest.fn(() => ({
    write: jest.fn(),
    finalize: jest.fn(async () => true),
    abort: jest.fn(async () => {}),
    getByteCount: jest.fn(() => 4096),
  })),
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
  FeatureFlag: {
    service: "service",
    recording: "recording",
    model: "model",
    transcription: "transcription",
    storage: "storage",
  },
}));

// Override expo-audio to include AudioModule.AudioRecorder
const makeMockRecorder = () => ({
  prepareToRecordAsync: jest.fn(),
  record: jest.fn(),
  stop: jest.fn(),
  release: jest.fn(),
  getStatus: jest.fn(() => ({ isRecording: true, metering: -30 })),
  getAvailableInputs: jest.fn().mockResolvedValue([]),
  uri: "file:///recording.wav",
  currentTime: 5,
});

jest.mock("expo-audio", () => ({
  AudioRecorder: jest.fn().mockImplementation(makeMockRecorder),
  AudioModule: {
    AudioRecorder: jest.fn().mockImplementation(makeMockRecorder),
    setAudioModeAsync: jest.fn(),
  },
  setAudioModeAsync: jest.fn(),
  getRecordingPermissionsAsync: jest.fn(async () => ({
    granted: true,
    status: "granted",
    canAskAgain: true,
  })),
  requestRecordingPermissionsAsync: jest.fn(async () => ({
    granted: true,
    status: "granted",
    canAskAgain: true,
  })),
  PermissionStatus: {
    GRANTED: "granted",
    DENIED: "denied",
    UNDETERMINED: "undetermined",
  },
}));

describe("AudioService", () => {
  let cleanupService: (() => Promise<void>) | null = null;

  beforeEach(() => {
    jest.resetModules();
    cleanupService = null;
  });

  afterEach(async () => {
    if (cleanupService) await cleanupService();
  });

  const setupPlatform = (os: string) => {
    const { Platform } = require("react-native");
    Object.defineProperty(Platform, "OS", { get: () => os });
  };

  const getExpoAudio = () => require("expo-audio");
  const getExpoHaptics = () => require("expo-haptics");
  const getAudioRecord = () =>
    require("@fugood/react-native-audio-pcm-stream").default;
  const getPermissionService = () =>
    require("./PermissionService").permissionService;
  const getCreatePcmStreamWriter = () =>
    require("@/utils").createPcmStreamWriter;

  describe("iOS recording", () => {
    it("startRecording checks permission, configures audio, creates recorder", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      const result = await audioService.startRecording();

      expect(getPermissionService().ensureRecordPermission).toHaveBeenCalled();
      expect(expoAudio.setAudioModeAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          allowsRecording: true,
          playsInSilentMode: true,
        }),
      );
      expect(result).toBe(true);
    });

    it("startRecording triggers haptic feedback", async () => {
      setupPlatform("ios");
      const haptics = getExpoHaptics();
      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      await audioService.startRecording();

      expect(haptics.impactAsync).toHaveBeenCalledWith(
        haptics.ImpactFeedbackStyle.Medium,
      );
    });

    it("stopRecording stops recorder, validates file, returns URI", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      const { File } = require("expo-file-system");
      (File as jest.Mock).mockImplementation(() => ({
        exists: true,
        size: 2048,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");

      await audioService.startRecording();

      // Get the recorder instance created during startRecording
      const recorderInstance =
        expoAudio.AudioModule.AudioRecorder.mock.results[0].value;

      const uri = await audioService.stopRecording();

      expect(recorderInstance.stop).toHaveBeenCalled();
      expect(recorderInstance.release).toHaveBeenCalled();
      expect(uri).toBe("file:///recording.wav");
    });

    it("stopRecording triggers haptic notification", async () => {
      setupPlatform("ios");
      const haptics = getExpoHaptics();
      const { File } = require("expo-file-system");
      (File as jest.Mock).mockImplementation(() => ({
        exists: true,
        size: 2048,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");

      await audioService.startRecording();
      await audioService.stopRecording();

      expect(haptics.notificationAsync).toHaveBeenCalledWith(
        haptics.NotificationFeedbackType.Success,
      );
    });
  });

  describe("Android recording", () => {
    it("startRecording inits AudioRecord with correct config and starts", async () => {
      setupPlatform("android");
      const AudioRecord = getAudioRecord();
      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");

      const result = await audioService.startRecording();

      expect(AudioRecord.init).toHaveBeenCalledWith(
        expect.objectContaining({
          sampleRate: 16000,
          channels: 1,
          bitsPerSample: 16,
        }),
      );
      expect(AudioRecord.start).toHaveBeenCalled();
      expect(getCreatePcmStreamWriter()).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("stopRecording stops AudioRecord, finalizes WAV, returns path", async () => {
      setupPlatform("android");
      const AudioRecord = getAudioRecord();
      const { File } = require("expo-file-system");
      (File as jest.Mock).mockImplementation(() => ({
        exists: true,
        size: 2048,
        uri: "file:///rec.wav",
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");

      await audioService.startRecording();
      const path = await audioService.stopRecording();

      expect(AudioRecord.stop).toHaveBeenCalled();
      expect(path).toContain(".wav");
    });
  });

  describe("Permission denied", () => {
    it("startRecording returns false when permission denied", async () => {
      setupPlatform("ios");
      getPermissionService().ensureRecordPermission.mockResolvedValueOnce(
        false,
      );

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");

      const result = await audioService.startRecording();
      expect(result).toBe(false);
    });
  });

  describe("subscribeToAudioLevel", () => {
    it("callback receives events and unsubscribe works", () => {
      setupPlatform("ios");
      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");

      const callback = jest.fn();
      const unsubscribe = audioService.subscribeToAudioLevel(callback);
      expect(typeof unsubscribe).toBe("function");
      unsubscribe();
    });
  });

  describe("dispose", () => {
    it("cleans up all resources", async () => {
      setupPlatform("ios");
      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");

      await audioService.dispose();
    });
  });

  describe("warmUpIosAudioInput", () => {
    it("records 50ms dummy on iOS", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");

      const result = await audioService.warmUpIosAudioInput();

      expect(result).toBe(true);
      const recorderInstance =
        expoAudio.AudioModule.AudioRecorder.mock.results[0].value;
      expect(recorderInstance.prepareToRecordAsync).toHaveBeenCalled();
      expect(recorderInstance.record).toHaveBeenCalled();
      expect(recorderInstance.stop).toHaveBeenCalled();
    });

    it("no-op on Android", async () => {
      setupPlatform("android");
      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");

      const result = await audioService.warmUpIosAudioInput();
      expect(result).toBe(true);
    });

    it("idempotent (returns true on second call)", async () => {
      setupPlatform("ios");

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");

      await audioService.warmUpIosAudioInput();

      const result = await audioService.warmUpIosAudioInput();
      expect(result).toBe(true);
    });
  });

  describe("pauseAmplitudeMonitoring / resumeAmplitudeMonitoring", () => {
    it("toggles monitoring", () => {
      setupPlatform("ios");
      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");

      audioService.pauseAmplitudeMonitoring();
      audioService.resumeAmplitudeMonitoring();
    });
  });

  describe("Error handling", () => {
    it("start failure cleans up", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      expoAudio.AudioModule.AudioRecorder.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest
          .fn()
          .mockRejectedValueOnce(new Error("fail")),
        record: jest.fn(),
        stop: jest.fn(),
        release: jest.fn(),
        getAvailableInputs: jest.fn().mockResolvedValue([]),
        uri: null,
        currentTime: 0,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");

      const result = await audioService.startRecording();
      expect(result).toBe(false);
    });

    it("stop failure returns null", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      expoAudio.AudioModule.AudioRecorder.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(),
        record: jest.fn(),
        stop: jest.fn().mockRejectedValueOnce(new Error("stop fail")),
        release: jest.fn(),
        getStatus: jest.fn(() => ({ isRecording: true, metering: -30 })),
        getAvailableInputs: jest.fn().mockResolvedValue([]),
        uri: "file:///recording.wav",
        currentTime: 5,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");

      await audioService.startRecording();
      const result = await audioService.stopRecording();
      expect(result).toBeNull();
    });
  });
});
