import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

const BACKGROUND_RECORDING_TASK = 'background-recording-task';

interface BackgroundRecordingCallbacks {
  onStopRecording?: () => void;
}

const createBackgroundRecordingService = () => {
  let isServiceRunning: boolean = false;
  let isActuallyRecording: boolean = false;
  const callbacks: BackgroundRecordingCallbacks = {};
  let notificationId: string | null = null;
  let notificationResponseSub: Notifications.EventSubscription | null = null;

  const setupTaskHandler = (): void => {
    TaskManager.defineTask(BACKGROUND_RECORDING_TASK, async () => {
      return;
    });
  };

  setupTaskHandler();

  const initialize = async (): Promise<void> => {
    if (Platform.OS === 'android') {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();

      if (existingStatus !== 'granted') {
        const { status: newStatus } =
          await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') {
          console.warn('Notification permission denied');
        }
      }

      await Notifications.setNotificationChannelAsync('echos_recording', {
        name: 'Echos Recording',
        description: 'Background recording service for Echos',
        importance: Notifications.AndroidImportance.LOW,
        sound: null,
        vibrationPattern: null,
        enableLights: false,
        enableVibrate: false,
        showBadge: false,
      });

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: false,
        }),
      });

      if (notificationResponseSub) {
        notificationResponseSub.remove();
        notificationResponseSub = null;
      }

      notificationResponseSub =
        Notifications.addNotificationResponseReceivedListener((response) => {
          if (response.actionIdentifier === 'stop_recording') {
            callbacks.onStopRecording?.();
          }
        });
    } else if (Platform.OS === 'ios') {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });
    }
  };

  const setOnStopRecordingCallback = (callback: () => void): void => {
    callbacks.onStopRecording = callback;
  };

  const updateRecordingState = (isRecording: boolean): void => {
    isActuallyRecording = isRecording;

    if (isServiceRunning && Platform.OS === 'android' && notificationId) {
      updateNotification(isRecording);
    }
  };

  const updateNotification = async (isRecording: boolean): Promise<void> => {
    if (Platform.OS !== 'android') return;

    try {
      if (notificationId) {
        await Notifications.dismissNotificationAsync(notificationId);
      }
      notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Echos',
          body: isRecording ? 'Recording in background' : 'Ready to record',
          sticky: true,
          priority: Notifications.AndroidNotificationPriority.LOW,
          categoryIdentifier: 'recording',
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Error updating notification:', error);
    }
  };

  const startBackgroundService = async (): Promise<boolean> => {
    if (isServiceRunning) {
      return true;
    }

    try {
      if (Platform.OS === 'android') {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          console.error('Missing notification permission');
          return false;
        }

        await Notifications.setNotificationCategoryAsync('recording', [
          {
            identifier: 'stop_recording',
            buttonTitle: 'Stop Recording',
            options: {
              opensAppToForeground: false,
            },
          },
        ]);

        const notificationResult =
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Echos - Recording',
              body: 'Tap to return to the app',
              priority: Notifications.AndroidNotificationPriority.LOW,
              categoryIdentifier: 'recording',
              sticky: true,
            },
            trigger: null,
          });

        notificationId = notificationResult;
      }

      isServiceRunning = true;
      return true;
    } catch (error) {
      console.error('Failed to start background service:', error);
      isServiceRunning = false;
      return false;
    }
  };

  const stopBackgroundService = async (): Promise<boolean> => {
    if (!isServiceRunning) {
      return true;
    }

    try {
      if (Platform.OS === 'android' && notificationId) {
        await Notifications.dismissNotificationAsync(notificationId);
        notificationId = null;
      }

      isServiceRunning = false;
      return true;
    } catch (error) {
      console.error('Failed to stop background service:', error);
      isServiceRunning = false;
      return false;
    }
  };

  const getServiceRunning = (): boolean => {
    return isServiceRunning;
  };

  const getActuallyRecording = (): boolean => {
    return isActuallyRecording;
  };

  const dispose = (): void => {
    if (notificationResponseSub) {
      notificationResponseSub.remove();
      notificationResponseSub = null;
    }
    callbacks.onStopRecording = undefined;
  };

  return {
    initialize,
    setOnStopRecordingCallback,
    updateRecordingState,
    startBackgroundService,
    stopBackgroundService,
    get serviceRunning() {
      return getServiceRunning();
    },
    get actuallyRecording() {
      return getActuallyRecording();
    },
    dispose,
  };
};

export const backgroundRecordingService = createBackgroundRecordingService();
export default backgroundRecordingService;
