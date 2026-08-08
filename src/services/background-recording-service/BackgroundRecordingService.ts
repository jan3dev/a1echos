import { PermissionsAndroid, Platform } from "react-native";

import { FeatureFlag, logError, logWarn } from "@/utils";

const NOTIFICATION_ID = 1001;
const TASK_ID = "echos_recording_task";

let isRegistered = false;
let notificationPermissionGranted: boolean | null = null;
let ForegroundService:
  | typeof import("@supersami/rn-foreground-service").default
  | null = null;

const getForegroundService = async () => {
  if (Platform.OS !== "android") {
    return null;
  }
  if (!ForegroundService) {
    const module = await import("@supersami/rn-foreground-service");
    ForegroundService = module.default;
  }
  return ForegroundService;
};

// Advisory only. Android starts a foreground service without POST_NOTIFICATIONS
// (13+/API 33+ runtime permission) — it just hides the notification, so
// recording must never be gated on the answer. Cached per session so a denial
// doesn't re-prompt on every recording.
const requestNotificationPermission = async (): Promise<boolean> => {
  if (Platform.OS !== "android" || Platform.Version < 33) {
    return true;
  }
  if (notificationPermissionGranted !== null) {
    return notificationPermissionGranted;
  }

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    notificationPermissionGranted =
      granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    logError(error, {
      flag: FeatureFlag.service,
      message: "Failed to request notification permission",
    });
    notificationPermissionGranted = false;
  }

  return notificationPermissionGranted;
};

export const registerForegroundService = async (): Promise<void> => {
  if (Platform.OS !== "android" || isRegistered) {
    return;
  }

  try {
    const service = await getForegroundService();
    if (!service) return;

    service.register({
      config: {
        alert: true,
        onServiceErrorCallBack: () => {
          logError("Foreground service error occurred", {
            flag: FeatureFlag.service,
          });
        },
      },
    });
    isRegistered = true;
  } catch (error) {
    logError(error, {
      flag: FeatureFlag.service,
      message: "Failed to register foreground service",
    });
  }
};

const createBackgroundRecordingService = () => {
  let isServiceRunning: boolean = false;

  const startBackgroundService = async (): Promise<boolean> => {
    if (isServiceRunning) {
      return true;
    }

    if (Platform.OS === "android") {
      try {
        const service = await getForegroundService();
        if (!service) {
          isServiceRunning = true;
          return true;
        }

        if (!(await requestNotificationPermission())) {
          logWarn(
            "Notification permission denied; recording continues in the background without a visible notification",
            { flag: FeatureFlag.service },
          );
        }

        await registerForegroundService();

        service.add_task(() => Promise.resolve(), {
          delay: 10000,
          onLoop: true,
          taskId: TASK_ID,
          onError: (e: Error) => {
            logError(e, {
              flag: FeatureFlag.service,
              message: "Foreground task error",
            });
          },
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
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.service,
          message: "Failed to start foreground service",
        });
        return false;
      }
    }

    isServiceRunning = true;
    return true;
  };

  const stopBackgroundService = async (): Promise<boolean> => {
    if (!isServiceRunning) {
      return true;
    }

    if (Platform.OS === "android") {
      try {
        const service = await getForegroundService();
        if (!service) {
          isServiceRunning = false;
          return true;
        }

        service.remove_task(TASK_ID);
        await service.stopAll();
        isServiceRunning = false;
        return true;
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.service,
          message: "Failed to stop foreground service",
        });
        isServiceRunning = false;
        return false;
      }
    }

    isServiceRunning = false;
    return true;
  };

  return {
    startBackgroundService,
    stopBackgroundService,
  };
};

export const backgroundRecordingService = createBackgroundRecordingService();
export default backgroundRecordingService;
