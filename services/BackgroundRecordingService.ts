import { PermissionsAndroid, Platform } from 'react-native';

import { FeatureFlag, logError, logWarn } from '@/utils';

const NOTIFICATION_ID = 1001;
const TASK_ID = 'echos_recording_task';

let isRegistered = false;
let notificationPermissionRequested = false;
let ForegroundService:
  | typeof import('@supersami/rn-foreground-service').default
  | null = null;

const getForegroundService = async () => {
  if (Platform.OS !== 'android') {
    return null;
  }
  if (!ForegroundService) {
    const module = await import('@supersami/rn-foreground-service');
    ForegroundService = module.default;
  }
  return ForegroundService;
};

const requestNotificationPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android' || notificationPermissionRequested) {
    return true;
  }

  // Android 13+ (API 33+) requires POST_NOTIFICATIONS permission
  if (Platform.Version >= 33) {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      notificationPermissionRequested = true;
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        logWarn('Notification permission not granted', {
          flag: FeatureFlag.service,
        });
        return false;
      }
      return true;
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.service,
        message: 'Failed to request notification permission',
      });
      return false;
    }
  }

  return true;
};

export const registerForegroundService = async (): Promise<void> => {
  if (Platform.OS !== 'android' || isRegistered) {
    return;
  }

  try {
    const service = await getForegroundService();
    if (!service) return;

    service.register({
      config: {
        alert: true,
        onServiceErrorCallBack: () => {
          logError('Foreground service error occurred', {
            flag: FeatureFlag.service,
          });
        },
      },
    });
    isRegistered = true;
  } catch (error) {
    logError(error, {
      flag: FeatureFlag.service,
      message: 'Failed to register foreground service',
    });
  }
};

const createBackgroundRecordingService = () => {
  let isServiceRunning: boolean = false;

  const startBackgroundService = async (): Promise<boolean> => {
    if (isServiceRunning) {
      return true;
    }

    if (Platform.OS === 'android') {
      try {
        const service = await getForegroundService();
        if (!service) {
          isServiceRunning = true;
          return true;
        }

        await requestNotificationPermission();
        await registerForegroundService();

        service.add_task(() => Promise.resolve(), {
          delay: 10000,
          onLoop: true,
          taskId: TASK_ID,
          onError: (e: Error) => {
            logError(e, {
              flag: FeatureFlag.service,
              message: 'Foreground task error',
            });
          },
        });

        try {
          await service.start({
            id: NOTIFICATION_ID,
            title: 'Echos',
            message: 'Recording in progress...',
            icon: 'ic_launcher',
            setOnlyAlertOnce: true,
            serviceType: 'microphone',
          });
        } catch {
          // Service may still work despite this error (common in debug builds)
          if (__DEV__) {
            logWarn('Foreground service start warning (debug only)', {
              flag: FeatureFlag.service,
            });
          }
        }

        isServiceRunning = true;
        return true;
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.service,
          message: 'Failed to start foreground service',
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

    if (Platform.OS === 'android') {
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
          message: 'Failed to stop foreground service',
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
