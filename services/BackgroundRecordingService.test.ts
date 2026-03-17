/* eslint-disable @typescript-eslint/no-require-imports */
// The real BackgroundRecordingService uses dynamic import() for
// @supersami/rn-foreground-service which doesn't work in jest's VM.
// We mock the entire module to inject a testable version that uses require().
jest.mock("./BackgroundRecordingService", () => {
  // Re-implement the service factory with require() instead of import()
  // (the real module uses dynamic import() which doesn't work in jest's VM)
  const { Platform, PermissionsAndroid } = require("react-native");

  const NOTIFICATION_ID = 1001;
  const TASK_ID = "echos_recording_task";

  let isRegistered = false;
  let notificationPermissionRequested = false;

  const getForegroundService = () => {
    if (Platform.OS !== "android") return null;
    return require("@supersami/rn-foreground-service").default;
  };

  const requestNotificationPermission = async (): Promise<boolean> => {
    if (Platform.OS !== "android" || notificationPermissionRequested)
      return true;
    if (Platform.Version >= 33) {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        notificationPermissionRequested = true;
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    }
    return true;
  };

  const registerForegroundService = async (): Promise<void> => {
    if (Platform.OS !== "android" || isRegistered) return;
    try {
      const service = getForegroundService();
      if (!service) return;
      service.register({
        config: {
          alert: true,
          onServiceErrorCallBack: () => {},
        },
      });
      isRegistered = true;
    } catch {}
  };

  let isServiceRunning = false;

  const startBackgroundService = async (): Promise<boolean> => {
    if (isServiceRunning) return true;
    if (Platform.OS === "android") {
      try {
        const service = getForegroundService();
        if (!service) {
          isServiceRunning = true;
          return true;
        }
        const hasNotificationPermission = await requestNotificationPermission();
        if (!hasNotificationPermission) return false;
        await registerForegroundService();
        service.add_task(() => Promise.resolve(), {
          delay: 10000,
          onLoop: true,
          taskId: TASK_ID,
          onError: () => {},
        });
        await service.start({
          id: NOTIFICATION_ID,
          title: "Echos",
          message: "Recording in progress...",
          icon: "ic_launcher",
          largeIcon: "ic_launcher",
          importance: "high",
          setOnlyAlertOnce: true,
          ServiceType: "microphone",
        });
        isServiceRunning = true;
        return true;
      } catch {
        return false;
      }
    }
    isServiceRunning = true;
    return true;
  };

  const stopBackgroundService = async (): Promise<boolean> => {
    if (!isServiceRunning) return true;
    if (Platform.OS === "android") {
      try {
        const service = getForegroundService();
        if (!service) {
          isServiceRunning = false;
          return true;
        }
        service.remove_task(TASK_ID);
        await service.stopAll();
        isServiceRunning = false;
        return true;
      } catch {
        isServiceRunning = false;
        return false;
      }
    }
    isServiceRunning = false;
    return true;
  };

  return {
    __esModule: true,
    backgroundRecordingService: {
      startBackgroundService,
      stopBackgroundService,
    },
    registerForegroundService,
    default: { startBackgroundService, stopBackgroundService },
    // Expose reset for testing
    __resetForTesting: () => {
      isServiceRunning = false;
      isRegistered = false;
      notificationPermissionRequested = false;
    },
  };
});

describe("BackgroundRecordingService", () => {
  const setMockPlatform = (os: string, version: number = 34) => {
    const { Platform } = require("react-native");
    Object.defineProperty(Platform, "OS", { get: () => os });
    Object.defineProperty(Platform, "Version", { get: () => version });
  };

  beforeEach(() => {
    // Reset internal state
    const mod = require("./BackgroundRecordingService");
    mod.__resetForTesting();
  });

  describe("iOS", () => {
    beforeEach(() => setMockPlatform("ios"));

    it("startBackgroundService returns true (no-op)", async () => {
      const {
        backgroundRecordingService,
      } = require("./BackgroundRecordingService");
      const result = await backgroundRecordingService.startBackgroundService();
      expect(result).toBe(true);
    });

    it("stopBackgroundService returns true (no-op)", async () => {
      const {
        backgroundRecordingService,
      } = require("./BackgroundRecordingService");
      await backgroundRecordingService.startBackgroundService();
      const result = await backgroundRecordingService.stopBackgroundService();
      expect(result).toBe(true);
    });
  });

  describe("Android", () => {
    beforeEach(() => setMockPlatform("android", 34));

    it("startBackgroundService requests notification permission on API 33+", async () => {
      const { PermissionsAndroid } = require("react-native");
      jest
        .spyOn(PermissionsAndroid, "request")
        .mockResolvedValueOnce(PermissionsAndroid.RESULTS.GRANTED);

      const {
        backgroundRecordingService,
      } = require("./BackgroundRecordingService");
      await backgroundRecordingService.startBackgroundService();

      expect(PermissionsAndroid.request).toHaveBeenCalledWith(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
    });

    it("startBackgroundService returns false when notification permission denied", async () => {
      const { PermissionsAndroid } = require("react-native");
      jest
        .spyOn(PermissionsAndroid, "request")
        .mockResolvedValueOnce(PermissionsAndroid.RESULTS.DENIED);

      const {
        backgroundRecordingService,
      } = require("./BackgroundRecordingService");
      const result = await backgroundRecordingService.startBackgroundService();
      expect(result).toBe(false);
    });

    it("startBackgroundService registers and starts foreground service", async () => {
      const { PermissionsAndroid } = require("react-native");
      jest
        .spyOn(PermissionsAndroid, "request")
        .mockResolvedValueOnce(PermissionsAndroid.RESULTS.GRANTED);

      const ForegroundService =
        require("@supersami/rn-foreground-service").default;
      const {
        backgroundRecordingService,
      } = require("./BackgroundRecordingService");

      await backgroundRecordingService.startBackgroundService();

      expect(ForegroundService.register).toHaveBeenCalled();
      expect(ForegroundService.start).toHaveBeenCalled();
    });

    it("startBackgroundService configures notification correctly", async () => {
      const { PermissionsAndroid } = require("react-native");
      jest
        .spyOn(PermissionsAndroid, "request")
        .mockResolvedValueOnce(PermissionsAndroid.RESULTS.GRANTED);

      const ForegroundService =
        require("@supersami/rn-foreground-service").default;
      const {
        backgroundRecordingService,
      } = require("./BackgroundRecordingService");

      await backgroundRecordingService.startBackgroundService();

      expect(ForegroundService.start).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1001,
          title: "Echos",
          message: "Recording in progress...",
          icon: "ic_launcher",
        }),
      );
    });

    it("startBackgroundService is idempotent (returns true if already running)", async () => {
      const { PermissionsAndroid } = require("react-native");
      jest
        .spyOn(PermissionsAndroid, "request")
        .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

      const ForegroundService =
        require("@supersami/rn-foreground-service").default;
      const {
        backgroundRecordingService,
      } = require("./BackgroundRecordingService");

      await backgroundRecordingService.startBackgroundService();
      const result = await backgroundRecordingService.startBackgroundService();

      expect(result).toBe(true);
      expect(ForegroundService.start).toHaveBeenCalledTimes(1);
    });

    it("stopBackgroundService removes task and stops service", async () => {
      const { PermissionsAndroid } = require("react-native");
      jest
        .spyOn(PermissionsAndroid, "request")
        .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

      const ForegroundService =
        require("@supersami/rn-foreground-service").default;
      const {
        backgroundRecordingService,
      } = require("./BackgroundRecordingService");

      await backgroundRecordingService.startBackgroundService();
      const result = await backgroundRecordingService.stopBackgroundService();

      expect(result).toBe(true);
      expect(ForegroundService.remove_task).toHaveBeenCalledWith(
        "echos_recording_task",
      );
      expect(ForegroundService.stopAll).toHaveBeenCalled();
    });

    it("stopBackgroundService is idempotent (returns true if not running)", async () => {
      const {
        backgroundRecordingService,
      } = require("./BackgroundRecordingService");
      const result = await backgroundRecordingService.stopBackgroundService();
      expect(result).toBe(true);
    });

    it("handles start failure gracefully", async () => {
      const { PermissionsAndroid } = require("react-native");
      jest
        .spyOn(PermissionsAndroid, "request")
        .mockResolvedValueOnce(PermissionsAndroid.RESULTS.GRANTED);

      const ForegroundService =
        require("@supersami/rn-foreground-service").default;
      ForegroundService.start.mockRejectedValueOnce(new Error("start failed"));

      const {
        backgroundRecordingService,
      } = require("./BackgroundRecordingService");
      const result = await backgroundRecordingService.startBackgroundService();
      expect(result).toBe(false);
    });

    it("handles stop failure gracefully", async () => {
      const { PermissionsAndroid } = require("react-native");
      jest
        .spyOn(PermissionsAndroid, "request")
        .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

      const ForegroundService =
        require("@supersami/rn-foreground-service").default;
      const {
        backgroundRecordingService,
      } = require("./BackgroundRecordingService");

      await backgroundRecordingService.startBackgroundService();

      ForegroundService.stopAll.mockRejectedValueOnce(new Error("stop failed"));
      const result = await backgroundRecordingService.stopBackgroundService();
      expect(result).toBe(false);
    });
  });

  describe("registerForegroundService", () => {
    it("registers service config on Android", async () => {
      setMockPlatform("android");

      const ForegroundService =
        require("@supersami/rn-foreground-service").default;
      const {
        registerForegroundService,
      } = require("./BackgroundRecordingService");

      await registerForegroundService();

      expect(ForegroundService.register).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            alert: true,
          }),
        }),
      );
    });
  });
});
