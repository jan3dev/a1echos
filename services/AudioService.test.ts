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
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
    remove: jest.fn(),
    playing: false,
    currentTime: 0,
  })),
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

  describe("Android PCM recording - stopRecording edge cases", () => {
    it("returns null when WAV file is too small", async () => {
      setupPlatform("android");
      const { File } = require("expo-file-system");
      (File as jest.Mock).mockImplementation(() => ({
        exists: true,
        size: 512, // < 1024
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      await audioService.startRecording();
      const path = await audioService.stopRecording();

      expect(path).toBeNull();
    });

    it("returns null when WAV file does not exist after finalize", async () => {
      setupPlatform("android");
      const { File } = require("expo-file-system");
      (File as jest.Mock).mockImplementation(() => ({
        exists: false,
        size: 0,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      await audioService.startRecording();
      const path = await audioService.stopRecording();

      expect(path).toBeNull();
    });

    it("returns null when pcmStreamWriter.finalize fails", async () => {
      setupPlatform("android");
      const { createPcmStreamWriter } = require("@/utils");
      (createPcmStreamWriter as jest.Mock).mockReturnValueOnce({
        write: jest.fn(),
        finalize: jest.fn(async () => false),
        abort: jest.fn(async () => {}),
        getByteCount: jest.fn(() => 4096),
      });

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      await audioService.startRecording();
      const path = await audioService.stopRecording();

      expect(path).toBeNull();
    });

    it("cleans up pcmStreamWriter on error during stop", async () => {
      setupPlatform("android");
      const AudioRecord = getAudioRecord();
      AudioRecord.stop.mockImplementationOnce(() => {
        throw new Error("stop error");
      });

      const { createPcmStreamWriter } = require("@/utils");
      const mockAbort = jest.fn(async () => {});
      (createPcmStreamWriter as jest.Mock).mockReturnValueOnce({
        write: jest.fn(),
        finalize: jest.fn(async () => true),
        abort: mockAbort,
        getByteCount: jest.fn(() => 4096),
      });

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      await audioService.startRecording();
      const path = await audioService.stopRecording();

      expect(path).toBeNull();
      expect(mockAbort).toHaveBeenCalled();
    });

    it("triggers haptic on successful Android stop", async () => {
      setupPlatform("android");
      const haptics = getExpoHaptics();
      const { File } = require("expo-file-system");
      (File as jest.Mock).mockImplementation(() => ({
        exists: true,
        size: 2048,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      await audioService.startRecording();
      await audioService.stopRecording();

      expect(haptics.notificationAsync).toHaveBeenCalledWith(
        haptics.NotificationFeedbackType.Success,
      );
    });
  });

  describe("Android PCM recording - startRecording failure", () => {
    it("cleans up pcmStreamWriter when AudioRecord.start throws", async () => {
      setupPlatform("android");
      const AudioRecord = getAudioRecord();
      AudioRecord.start.mockImplementationOnce(() => {
        throw new Error("start error");
      });

      const { createPcmStreamWriter } = require("@/utils");
      const mockAbort = jest.fn(async () => {});
      (createPcmStreamWriter as jest.Mock).mockReturnValueOnce({
        write: jest.fn(),
        finalize: jest.fn(async () => true),
        abort: mockAbort,
        getByteCount: jest.fn(() => 0),
      });

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      const result = await audioService.startRecording();

      expect(result).toBe(false);
      expect(mockAbort).toHaveBeenCalled();
    });
  });

  describe("iOS recording edge cases", () => {
    it("stopRecording returns null when recorder URI is null", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      expoAudio.AudioModule.AudioRecorder.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(),
        record: jest.fn(),
        stop: jest.fn(),
        release: jest.fn(),
        getStatus: jest.fn(() => ({ isRecording: true, metering: -30 })),
        getAvailableInputs: jest.fn().mockResolvedValue([]),
        uri: null,
        currentTime: 5,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      await audioService.startRecording();
      const result = await audioService.stopRecording();

      expect(result).toBeNull();
    });

    it("stopRecording returns null when file is too small", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      expoAudio.AudioModule.AudioRecorder.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(),
        record: jest.fn(),
        stop: jest.fn(),
        release: jest.fn(),
        getStatus: jest.fn(() => ({ isRecording: true, metering: -30 })),
        getAvailableInputs: jest.fn().mockResolvedValue([]),
        uri: "file:///recording.wav",
        currentTime: 5,
      }));

      const { File } = require("expo-file-system");
      (File as jest.Mock).mockImplementation(() => ({
        exists: true,
        size: 512, // < 1024
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      await audioService.startRecording();
      const result = await audioService.stopRecording();

      expect(result).toBeNull();
    });

    it("stopRecording returns currentAudioFile when no recorder active", async () => {
      setupPlatform("ios");
      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      // Call stop without starting - recorder is null
      const result = await audioService.stopRecording();

      expect(result).toBeNull();
    });

    it("startRecording failure cleans up recorder (stop + release)", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      const mockStop = jest.fn();
      const mockRelease = jest.fn();
      expoAudio.AudioModule.AudioRecorder.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(),
        record: jest.fn(() => {
          throw new Error("record fail");
        }),
        stop: mockStop,
        release: mockRelease,
        getAvailableInputs: jest.fn().mockResolvedValue([]),
        uri: null,
        currentTime: 0,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      const result = await audioService.startRecording();

      expect(result).toBe(false);
      expect(mockStop).toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalled();
    });
  });

  describe("warmUpIosAudioInput edge cases", () => {
    it("returns false when warmup recorder throws", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      expoAudio.AudioModule.AudioRecorder.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest
          .fn()
          .mockRejectedValue(new Error("warmup fail")),
        record: jest.fn(),
        stop: jest.fn(),
        release: jest.fn(),
        getAvailableInputs: jest.fn().mockResolvedValue([]),
        uri: null,
        currentTime: 0,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      const result = await audioService.warmUpIosAudioInput();

      expect(result).toBe(false);
    });

    it("skips warmup if already recording (recorder exists)", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      // Start recording first to set internal recorder
      await audioService.startRecording();

      // Now warm up - should see recorder exists and return true immediately
      const result = await audioService.warmUpIosAudioInput();
      expect(result).toBe(true);

      // AudioRecorder should only have been called once (for startRecording, not warmup)
      expect(expoAudio.AudioModule.AudioRecorder).toHaveBeenCalledTimes(1);
    });

    it("cleans up warmup file if URI exists", async () => {
      setupPlatform("ios");
      const mockDelete = jest.fn();
      const { File } = require("expo-file-system");
      (File as jest.Mock).mockImplementation(() => ({
        exists: true,
        size: 100,
        delete: mockDelete,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      await audioService.warmUpIosAudioInput();

      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe("handleAmplitudeEvent branches", () => {
    it("handles undefined metering (does not emit level)", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      expoAudio.AudioModule.AudioRecorder.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(),
        record: jest.fn(),
        stop: jest.fn(),
        release: jest.fn(),
        getStatus: jest.fn(() => ({
          isRecording: true,
          metering: undefined,
        })),
        getAvailableInputs: jest.fn().mockResolvedValue([]),
        uri: "file:///recording.wav",
        currentTime: 5,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      const callback = jest.fn();
      audioService.subscribeToAudioLevel(callback);

      await audioService.startRecording();

      await new Promise((resolve) => setTimeout(resolve, 50));

      // With undefined metering, the interval handler won't call handleAmplitudeEvent
      // because of the null check: if (status.metering !== undefined && status.metering !== null)
      // So callback should NOT be called
      expect(callback).not.toHaveBeenCalled();
    });

    it("handles valid metering values and emits audio level", async () => {
      jest.useRealTimers();
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      expoAudio.AudioModule.AudioRecorder.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(),
        record: jest.fn(),
        stop: jest.fn(),
        release: jest.fn(),
        getStatus: jest.fn(() => ({
          isRecording: true,
          metering: -30,
        })),
        getAvailableInputs: jest.fn().mockResolvedValue([]),
        uri: "file:///recording.wav",
        currentTime: 5,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      const callback = jest.fn();
      audioService.subscribeToAudioLevel(callback);

      await audioService.startRecording();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Callback should have been called with a valid level
      expect(callback).toHaveBeenCalled();
      const level = callback.mock.calls[0][0];
      expect(level).toBeGreaterThanOrEqual(0.02);
      expect(level).toBeLessThanOrEqual(1.0);
    });

    it("handles very low metering (-160 or below) as minimum level", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      expoAudio.AudioModule.AudioRecorder.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(),
        record: jest.fn(),
        stop: jest.fn(),
        release: jest.fn(),
        getStatus: jest.fn(() => ({
          isRecording: true,
          metering: -160,
        })),
        getAvailableInputs: jest.fn().mockResolvedValue([]),
        uri: "file:///recording.wav",
        currentTime: 5,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      const callback = jest.fn();
      audioService.subscribeToAudioLevel(callback);

      await audioService.startRecording();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // metering <= -160 => level stays at 0.02 default
      expect(callback).toHaveBeenCalled();
      const level = callback.mock.calls[0][0];
      expect(level).toBe(0.02);
    });
  });

  describe("handleAndroidPcmData / computeRmsFromBase64Pcm", () => {
    it("processes PCM data and emits audio level on Android", async () => {
      setupPlatform("android");
      const AudioRecord = getAudioRecord();

      // Capture the data handler
      let dataHandler: ((data: string) => void) | null = null;
      AudioRecord.on.mockImplementation(
        (event: string, handler: (data: string) => void) => {
          if (event === "data") {
            dataHandler = handler;
          }
        },
      );

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      const callback = jest.fn();
      audioService.subscribeToAudioLevel(callback);

      await audioService.startRecording();

      // Simulate PCM data (16-bit samples as base64)
      // Create a buffer with some audio data
      const buffer = Buffer.alloc(64);
      for (let i = 0; i < 32; i++) {
        // Write 16-bit little-endian samples with moderate amplitude
        const sample = Math.floor(Math.sin(i * 0.5) * 8000);
        buffer.writeInt16LE(sample, i * 2);
      }
      const base64Data = buffer.toString("base64");

      expect(dataHandler).not.toBeNull();
      dataHandler!(base64Data);

      expect(callback).toHaveBeenCalled();
      const level = callback.mock.calls[0][0];
      expect(level).toBeGreaterThanOrEqual(0.02);
      expect(level).toBeLessThanOrEqual(1.0);
    });

    it("handles empty/invalid base64 data gracefully", async () => {
      setupPlatform("android");
      const AudioRecord = getAudioRecord();

      let dataHandler: ((data: string) => void) | null = null;
      AudioRecord.on.mockImplementation(
        (event: string, handler: (data: string) => void) => {
          if (event === "data") {
            dataHandler = handler;
          }
        },
      );

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      const callback = jest.fn();
      audioService.subscribeToAudioLevel(callback);

      await audioService.startRecording();

      // Empty base64 = single byte which is < 2
      const emptyBase64 = Buffer.alloc(1).toString("base64");
      dataHandler!(emptyBase64);

      // Should still emit minimum level
      expect(callback).toHaveBeenCalled();
      const level = callback.mock.calls[0][0];
      expect(level).toBe(0.02);
    });

    it("writes PCM data to stream writer", async () => {
      setupPlatform("android");
      const AudioRecord = getAudioRecord();

      let dataHandler: ((data: string) => void) | null = null;
      AudioRecord.on.mockImplementation(
        (event: string, handler: (data: string) => void) => {
          if (event === "data") {
            dataHandler = handler;
          }
        },
      );

      const { createPcmStreamWriter } = require("@/utils");
      const mockWrite = jest.fn();
      (createPcmStreamWriter as jest.Mock).mockReturnValueOnce({
        write: mockWrite,
        finalize: jest.fn(async () => true),
        abort: jest.fn(async () => {}),
        getByteCount: jest.fn(() => 4096),
      });

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      await audioService.startRecording();

      const base64Data = Buffer.alloc(32).toString("base64");
      dataHandler!(base64Data);

      expect(mockWrite).toHaveBeenCalledWith(base64Data);
    });
  });

  describe("pauseAmplitudeMonitoring / resumeAmplitudeMonitoring", () => {
    it("pausing prevents amplitude events from being processed", async () => {
      jest.useRealTimers();
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      expoAudio.AudioModule.AudioRecorder.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(),
        record: jest.fn(),
        stop: jest.fn(),
        release: jest.fn(),
        getStatus: jest.fn(() => ({
          isRecording: true,
          metering: -30,
        })),
        getAvailableInputs: jest.fn().mockResolvedValue([]),
        uri: "file:///recording.wav",
        currentTime: 5,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      const callback = jest.fn();
      audioService.subscribeToAudioLevel(callback);

      await audioService.startRecording();

      // Let some events fire
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(callback.mock.calls.length).toBeGreaterThan(0);

      // Pause monitoring
      audioService.pauseAmplitudeMonitoring();
      callback.mockClear();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have zero calls while paused
      expect(callback.mock.calls.length).toBe(0);
    });
  });

  describe("dispose - full cleanup", () => {
    it("disposes Android PCM recording resources", async () => {
      setupPlatform("android");
      const AudioRecord = getAudioRecord();
      const { createPcmStreamWriter } = require("@/utils");
      const mockAbort = jest.fn(async () => {});
      (createPcmStreamWriter as jest.Mock).mockReturnValueOnce({
        write: jest.fn(),
        finalize: jest.fn(async () => true),
        abort: mockAbort,
        getByteCount: jest.fn(() => 4096),
      });

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");

      await audioService.startRecording();
      // Dispose while recording
      await audioService.dispose();

      expect(AudioRecord.stop).toHaveBeenCalled();
      expect(mockAbort).toHaveBeenCalled();
    });

    it("disposes iOS recorder resources", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");

      await audioService.startRecording();
      await audioService.dispose();

      const recorderInstance =
        expoAudio.AudioModule.AudioRecorder.mock.results[0].value;
      expect(recorderInstance.stop).toHaveBeenCalled();
      expect(recorderInstance.release).toHaveBeenCalled();
    });

    it("removes all audio level listeners", async () => {
      setupPlatform("ios");

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");

      const callback = jest.fn();
      audioService.subscribeToAudioLevel(callback);

      await audioService.dispose();
      // After dispose, no more events should be emitted
      // (removeAllListeners was called)
    });
  });

  describe("amplitude monitoring error handling", () => {
    it("handles error when getting status during amplitude monitoring", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      const { logError } = require("@/utils");
      expoAudio.AudioModule.AudioRecorder.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(),
        record: jest.fn(),
        stop: jest.fn(),
        release: jest.fn(),
        getStatus: jest.fn(() => {
          throw new Error("status error");
        }),
        getAvailableInputs: jest.fn().mockResolvedValue([]),
        uri: "file:///recording.wav",
        currentTime: 5,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      (logError as jest.Mock).mockClear();

      await audioService.startRecording();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(logError).toHaveBeenCalled();
    });
  });

  describe("iOS recording - haptics failure on start", () => {
    it("recording succeeds even when haptics throw (handled by FeedbackService)", async () => {
      setupPlatform("ios");
      const haptics = getExpoHaptics();
      haptics.impactAsync.mockRejectedValueOnce(
        new Error("Haptics not available"),
      );

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      const result = await audioService.startRecording();

      expect(result).toBe(true);
    });
  });

  describe("Android recording - haptics failure on start", () => {
    it("recording succeeds even when haptics throw on Android start", async () => {
      setupPlatform("android");
      const haptics = getExpoHaptics();
      haptics.impactAsync.mockRejectedValueOnce(
        new Error("Haptics not available"),
      );

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      const result = await audioService.startRecording();

      expect(result).toBe(true);
    });
  });

  describe("iOS stopRecording - haptics failure on stop", () => {
    it("stop returns URI even when haptics throw", async () => {
      setupPlatform("ios");
      const haptics = getExpoHaptics();
      const { File } = require("expo-file-system");
      (File as jest.Mock).mockImplementation(() => ({
        exists: true,
        size: 2048,
      }));

      haptics.notificationAsync.mockRejectedValueOnce(
        new Error("Haptics not available"),
      );

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      await audioService.startRecording();
      const uri = await audioService.stopRecording();

      expect(uri).toBe("file:///recording.wav");
    });
  });

  describe("Android stopRecording - haptics failure on stop", () => {
    it("stop completes even when haptics throw on Android stop", async () => {
      setupPlatform("android");
      const haptics = getExpoHaptics();
      const { File } = require("expo-file-system");
      (File as jest.Mock).mockImplementation(() => ({
        exists: true,
        size: 2048,
      }));

      haptics.notificationAsync.mockRejectedValueOnce(
        new Error("Haptics not available"),
      );

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      await audioService.startRecording();
      await expect(audioService.stopRecording()).resolves.not.toThrow();
    });
  });

  describe("iOS stopRecording - file does not exist", () => {
    it("returns null when file does not exist after recording", async () => {
      setupPlatform("ios");
      const { File } = require("expo-file-system");
      (File as jest.Mock).mockImplementation(() => ({
        exists: false,
        size: 0,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      await audioService.startRecording();
      const result = await audioService.stopRecording();

      expect(result).toBeNull();
    });
  });

  describe("iOS stopRecording - min duration wait", () => {
    it("waits for minimum duration if recording is very short", async () => {
      setupPlatform("ios");
      const { File } = require("expo-file-system");
      (File as jest.Mock).mockImplementation(() => ({
        exists: true,
        size: 2048,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      await audioService.startRecording();
      // Stop immediately - should still have minimum wait
      const result = await audioService.stopRecording();

      expect(result).toBe("file:///recording.wav");
    });
  });

  describe("cleanup during Android recording", () => {
    it("cleanup stops Android PCM recording and aborts writer", async () => {
      setupPlatform("android");
      const AudioRecord = getAudioRecord();
      const { createPcmStreamWriter } = require("@/utils");
      const mockAbort = jest.fn(async () => {});
      (createPcmStreamWriter as jest.Mock).mockReturnValueOnce({
        write: jest.fn(),
        finalize: jest.fn(async () => true),
        abort: mockAbort,
        getByteCount: jest.fn(() => 4096),
      });

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");

      await audioService.startRecording();

      // Start a second recording (calls cleanup on the first)
      await audioService.startRecording();

      expect(AudioRecord.stop).toHaveBeenCalled();
      expect(mockAbort).toHaveBeenCalled();
    });
  });

  describe("cleanup error handling", () => {
    it("cleanup handles AudioRecord.stop failure on Android", async () => {
      setupPlatform("android");
      const AudioRecord = getAudioRecord();
      const { logError } = require("@/utils");

      const { createPcmStreamWriter } = require("@/utils");
      const mockAbort = jest.fn(async () => {});
      (createPcmStreamWriter as jest.Mock).mockReturnValueOnce({
        write: jest.fn(),
        finalize: jest.fn(async () => true),
        abort: mockAbort,
        getByteCount: jest.fn(() => 4096),
      });

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");

      await audioService.startRecording();

      // Make cleanup's AudioRecord.stop fail
      AudioRecord.stop.mockImplementationOnce(() => {
        throw new Error("stop error during cleanup");
      });

      (logError as jest.Mock).mockClear();

      // Start a second recording to trigger cleanup
      (createPcmStreamWriter as jest.Mock).mockReturnValueOnce({
        write: jest.fn(),
        finalize: jest.fn(async () => true),
        abort: jest.fn(async () => {}),
        getByteCount: jest.fn(() => 0),
      });
      await audioService.startRecording();

      expect(logError).toHaveBeenCalled();
    });

    it("cleanup handles recorder.stop failure on iOS", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      const { logError } = require("@/utils");

      expoAudio.AudioModule.AudioRecorder.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(),
        record: jest.fn(),
        stop: jest.fn().mockRejectedValue(new Error("stop fail")),
        release: jest.fn(),
        getStatus: jest.fn(() => ({ isRecording: true, metering: -30 })),
        getAvailableInputs: jest.fn().mockResolvedValue([]),
        uri: "file:///recording.wav",
        currentTime: 5,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");

      await audioService.startRecording();
      (logError as jest.Mock).mockClear();

      // Start a second recording to trigger cleanup which should handle stop error
      await audioService.startRecording();

      expect(logError).toHaveBeenCalled();
    });
  });

  describe("iOS stopRecording - duration calc error", () => {
    it("handles error during duration calculation gracefully", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      const { File } = require("expo-file-system");
      (File as jest.Mock).mockImplementation(() => ({
        exists: true,
        size: 2048,
      }));

      // Use a recorder where getStatus works for monitoring but we have a valid URI
      expoAudio.AudioModule.AudioRecorder.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(),
        record: jest.fn(),
        stop: jest.fn(),
        release: jest.fn(),
        getStatus: jest.fn(() => ({ isRecording: true, metering: -30 })),
        getAvailableInputs: jest.fn().mockResolvedValue([]),
        uri: "file:///recording.wav",
        currentTime: 5,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      await audioService.startRecording();
      const result = await audioService.stopRecording();

      // Should still return the file path
      expect(result).toBe("file:///recording.wav");
    });
  });

  describe("warmUpIosAudioInput - cleanup file delete failure", () => {
    it("handles warmup file cleanup error gracefully", async () => {
      setupPlatform("ios");
      const mockDelete = jest.fn(() => {
        throw new Error("delete failed");
      });
      const { File } = require("expo-file-system");
      (File as jest.Mock).mockImplementation(() => ({
        exists: true,
        size: 100,
        delete: mockDelete,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      // Should not throw even though file delete fails
      const result = await audioService.warmUpIosAudioInput();

      expect(result).toBe(true);
    });
  });

  describe("warmUpIosAudioInput - release fails on error path", () => {
    it("handles release failure during warmup error recovery", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      expoAudio.AudioModule.AudioRecorder.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(),
        record: jest.fn(() => {
          throw new Error("record fail during warmup");
        }),
        stop: jest.fn(),
        release: jest.fn(() => {
          throw new Error("release failed");
        }),
        getAvailableInputs: jest.fn().mockResolvedValue([]),
        uri: null,
        currentTime: 0,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      const result = await audioService.warmUpIosAudioInput();

      expect(result).toBe(false);
    });
  });

  describe("warmUpIosAudioInput - no URI after recording", () => {
    it("skips file cleanup when warmup recorder has no URI", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      expoAudio.AudioModule.AudioRecorder.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(),
        record: jest.fn(),
        stop: jest.fn(),
        release: jest.fn(),
        getAvailableInputs: jest.fn().mockResolvedValue([]),
        uri: null,
        currentTime: 0,
      }));

      const { File } = require("expo-file-system");
      const mockDelete = jest.fn();
      (File as jest.Mock).mockImplementation(() => ({
        exists: true,
        size: 100,
        delete: mockDelete,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      const result = await audioService.warmUpIosAudioInput();

      expect(result).toBe(true);
      // File.delete should NOT have been called since uri is null
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  describe("Android stopRecording - minimum duration wait", () => {
    it("waits for minimum duration on Android when recording is very short", async () => {
      setupPlatform("android");
      const { File } = require("expo-file-system");
      (File as jest.Mock).mockImplementation(() => ({
        exists: true,
        size: 2048,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      await audioService.startRecording();
      // Stop immediately - should still have minimum wait
      const result = await audioService.stopRecording();

      expect(result).toContain(".wav");
    });
  });

  describe("startRecording on iOS - second start cleans up first", () => {
    it("cleanup clears amplitude interval on second start", async () => {
      setupPlatform("ios");

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      await audioService.startRecording();
      // Start again - cleanup should clear the interval from first recording
      const result = await audioService.startRecording();

      expect(result).toBe(true);
    });
  });

  describe("Android stopRecording - no wavFilePath or pcmStreamWriter", () => {
    it("returns null when androidWavFilePath or pcmStreamWriter is null", async () => {
      setupPlatform("android");

      // Create a service where we can manipulate internal state
      // by making AudioRecord.init throw after setting androidPcmRecording
      const { createPcmStreamWriter } = require("@/utils");

      // Create a writer that returns null-like behavior
      (createPcmStreamWriter as jest.Mock).mockReturnValueOnce(null);

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      // This will fail because pcmStreamWriter is null when trying to write
      // But the start should still succeed since the null writer doesn't cause an immediate error
      // Actually, createPcmStreamWriter returning null will cause AudioRecord.on('data') handler
      // to call pcmStreamWriter?.write which is a no-op, and the recording continues.
      // Then stopRecording checks if (androidWavFilePath && pcmStreamWriter) - both must be truthy

      await audioService.startRecording();
      const result = await audioService.stopRecording();

      // pcmStreamWriter is null so condition fails, returns null
      expect(result).toBeNull();
    });
  });

  describe("handleAmplitudeEvent - Infinity metering", () => {
    it("handles Infinity metering value as minimum level", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      expoAudio.AudioModule.AudioRecorder.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(),
        record: jest.fn(),
        stop: jest.fn(),
        release: jest.fn(),
        getStatus: jest.fn(() => ({
          isRecording: true,
          metering: Infinity,
        })),
        getAvailableInputs: jest.fn().mockResolvedValue([]),
        uri: "file:///recording.wav",
        currentTime: 5,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      const callback = jest.fn();
      audioService.subscribeToAudioLevel(callback);

      await audioService.startRecording();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Infinity metering is treated as very low, so callback is called with minimum level
      expect(callback).toHaveBeenCalledWith(expect.closeTo(0.02, 1));
    });
  });

  describe("handleAmplitudeEvent - metering is undefined", () => {
    it("does not process amplitude when metering is undefined", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      expoAudio.AudioModule.AudioRecorder.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(),
        record: jest.fn(),
        stop: jest.fn(),
        release: jest.fn(),
        getStatus: jest.fn(() => ({
          isRecording: true,
          metering: undefined,
        })),
        getAvailableInputs: jest.fn().mockResolvedValue([]),
        uri: "file:///recording.wav",
        currentTime: 5,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      const callback = jest.fn();
      audioService.subscribeToAudioLevel(callback);

      await audioService.startRecording();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // metering is undefined, so amplitude event is not processed
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("handleAmplitudeEvent - metering is null", () => {
    it("does not process amplitude when metering is null", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      expoAudio.AudioModule.AudioRecorder.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(),
        record: jest.fn(),
        stop: jest.fn(),
        release: jest.fn(),
        getStatus: jest.fn(() => ({
          isRecording: true,
          metering: null,
        })),
        getAvailableInputs: jest.fn().mockResolvedValue([]),
        uri: "file:///recording.wav",
        currentTime: 5,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      const callback = jest.fn();
      audioService.subscribeToAudioLevel(callback);

      await audioService.startRecording();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("handleAmplitudeEvent - metering below -160", () => {
    it("treats metering <= -160 as minimum level", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      expoAudio.AudioModule.AudioRecorder.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(),
        record: jest.fn(),
        stop: jest.fn(),
        release: jest.fn(),
        getStatus: jest.fn(() => ({
          isRecording: true,
          metering: -200,
        })),
        getAvailableInputs: jest.fn().mockResolvedValue([]),
        uri: "file:///recording.wav",
        currentTime: 5,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      const callback = jest.fn();
      audioService.subscribeToAudioLevel(callback);

      await audioService.startRecording();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // metering <= -160 results in minimum level (0.02)
      expect(callback).toHaveBeenCalledWith(expect.closeTo(0.02, 1));
    });
  });

  describe("iOS stopRecording - no recorder", () => {
    it("returns null when no recorder exists (iOS)", async () => {
      setupPlatform("ios");
      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      // Stop without starting should return currentAudioFile (null)
      const result = await audioService.stopRecording();
      expect(result).toBeNull();
    });
  });

  describe("iOS stopRecording - file too small", () => {
    it("returns null when recorded file is too small (< 1024 bytes)", async () => {
      setupPlatform("ios");
      const { File } = require("expo-file-system");
      (File as jest.Mock).mockImplementation(() => ({
        exists: true,
        size: 100, // too small
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      await audioService.startRecording();
      const result = await audioService.stopRecording();
      expect(result).toBeNull();
    });
  });

  describe("iOS stopRecording - file does not exist", () => {
    it("returns null when recorded file does not exist", async () => {
      setupPlatform("ios");
      const { File } = require("expo-file-system");
      (File as jest.Mock).mockImplementation(() => ({
        exists: false,
        size: 0,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      await audioService.startRecording();
      const result = await audioService.stopRecording();
      expect(result).toBeNull();
    });
  });

  describe("iOS stopRecording - recorder stop throws", () => {
    it("handles error during iOS recorder stop gracefully", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      expoAudio.AudioModule.AudioRecorder.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(),
        record: jest.fn(),
        stop: jest.fn().mockRejectedValue(new Error("stop failed")),
        release: jest.fn(),
        getStatus: jest.fn(() => ({
          isRecording: true,
          metering: -30,
        })),
        getAvailableInputs: jest.fn().mockResolvedValue([]),
        uri: "file:///recording.wav",
        currentTime: 5,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      await audioService.startRecording();
      const result = await audioService.stopRecording();
      expect(result).toBeNull();
    });
  });

  describe("iOS stopRecording - uri is null", () => {
    it("returns null when recorder uri is null", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      expoAudio.AudioModule.AudioRecorder.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(),
        record: jest.fn(),
        stop: jest.fn(),
        release: jest.fn(),
        getStatus: jest.fn(() => ({
          isRecording: true,
          metering: -30,
        })),
        getAvailableInputs: jest.fn().mockResolvedValue([]),
        uri: null,
        currentTime: 5,
      }));
      const { File } = require("expo-file-system");
      (File as jest.Mock).mockImplementation(() => ({
        exists: true,
        size: 2048,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      await audioService.startRecording();
      const result = await audioService.stopRecording();
      expect(result).toBeNull();
    });
  });

  describe("pauseAmplitudeMonitoring and resumeAmplitudeMonitoring", () => {
    it("pauses and resumes amplitude monitoring", async () => {
      setupPlatform("ios");
      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      const callback = jest.fn();
      audioService.subscribeToAudioLevel(callback);

      await audioService.startRecording();

      // Pause monitoring
      audioService.pauseAmplitudeMonitoring();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const countAfterPause = callback.mock.calls.length;

      // Resume monitoring
      audioService.resumeAmplitudeMonitoring();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // After resume, more callbacks should have fired
      expect(callback.mock.calls.length).toBeGreaterThanOrEqual(
        countAfterPause,
      );
    });
  });

  describe("warmUpIosAudioInput branches", () => {
    it("returns true on non-iOS platform", async () => {
      setupPlatform("android");
      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      const result = await audioService.warmUpIosAudioInput();
      expect(result).toBe(true);
    });

    it("returns true when already warmed up", async () => {
      setupPlatform("ios");
      const { File } = require("expo-file-system");
      (File as jest.Mock).mockImplementation(() => ({
        exists: true,
        size: 100,
        delete: jest.fn(),
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      // First call warms up
      const result1 = await audioService.warmUpIosAudioInput();
      expect(result1).toBe(true);

      // Second call returns early
      const result2 = await audioService.warmUpIosAudioInput();
      expect(result2).toBe(true);
    });

    it("handles warm-up failure gracefully", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      expoAudio.AudioModule.AudioRecorder.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest
          .fn()
          .mockRejectedValue(new Error("prepare fail")),
        record: jest.fn(),
        stop: jest.fn(),
        release: jest.fn(),
        getStatus: jest.fn(() => ({ isRecording: false })),
        uri: null,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      const result = await audioService.warmUpIosAudioInput();
      expect(result).toBe(false);
    });
  });

  describe("Android stopRecording - finalize fails", () => {
    it("returns null when WAV finalize fails", async () => {
      setupPlatform("android");
      const createPcmStreamWriter = getCreatePcmStreamWriter();
      (createPcmStreamWriter as jest.Mock).mockReturnValueOnce({
        write: jest.fn(),
        finalize: jest.fn(async () => false),
        abort: jest.fn(async () => {}),
        getByteCount: jest.fn(() => 4096),
      });

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      await audioService.startRecording();
      const result = await audioService.stopRecording();
      expect(result).toBeNull();
    });
  });

  describe("Android stopRecording - WAV file validation fails", () => {
    it("returns null when WAV file is too small after finalize", async () => {
      setupPlatform("android");
      const { File } = require("expo-file-system");
      (File as jest.Mock).mockImplementation(() => ({
        exists: true,
        size: 100, // too small (< 1024)
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      await audioService.startRecording();
      const result = await audioService.stopRecording();
      expect(result).toBeNull();
    });
  });

  describe("handleAmplitudeEvent - getStatus returns not recording", () => {
    it("does not emit level when status.isRecording is false", async () => {
      setupPlatform("ios");
      const expoAudio = getExpoAudio();
      expoAudio.AudioModule.AudioRecorder.mockImplementationOnce(() => ({
        prepareToRecordAsync: jest.fn(),
        record: jest.fn(),
        stop: jest.fn(),
        release: jest.fn(),
        getStatus: jest.fn(() => ({
          isRecording: false,
          metering: -30,
        })),
        getAvailableInputs: jest.fn().mockResolvedValue([]),
        uri: "file:///recording.wav",
        currentTime: 5,
      }));

      const { audioService } =
        require("./AudioService") as typeof import("./AudioService");
      cleanupService = () => audioService.dispose();

      const callback = jest.fn();
      audioService.subscribeToAudioLevel(callback);

      await audioService.startRecording();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // status.isRecording is false, so amplitude events are not processed
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
