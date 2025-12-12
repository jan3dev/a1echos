import { setAudioModeAsync } from 'expo-audio';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

interface BackgroundRecordingCallbacks {
  onStopRecording?: () => void;
}

type NotificationsModule = typeof import('expo-notifications');
type EventSubscription = import('expo-notifications').EventSubscription;

const createBackgroundRecordingService = () => {
  let isServiceRunning: boolean = false;
  const callbacks: BackgroundRecordingCallbacks = {};
  let notificationId: string | null = null;
  let notificationResponseSub: EventSubscription | null = null;
  let Notifications: NotificationsModule | null = null;
  let notificationsAvailable = false;

  const loadNotifications = async (): Promise<NotificationsModule | null> => {
    if (Notifications) return Notifications;
    if (isExpoGo && Platform.OS === 'android') {
      return null;
    }

    try {
      Notifications = await import('expo-notifications');
      notificationsAvailable = true;
      return Notifications;
    } catch (error) {
      console.warn('expo-notifications not available:', error);
      return null;
    }
  };

  const initialize = async (): Promise<void> => {
    if (Platform.OS === 'android') {
      const notif = await loadNotifications();

      if (notif && notificationsAvailable) {
        try {
          const { status: existingStatus } = await notif.getPermissionsAsync();

          if (existingStatus !== 'granted') {
            const { status: newStatus } = await notif.requestPermissionsAsync();
            if (newStatus !== 'granted') {
              console.warn(
                'Notification permission denied - recording will work without status bar indicator'
              );
            }
          }

          await notif.setNotificationChannelAsync('echos_recording', {
            name: 'Echos Recording',
            description: 'Background recording service for Echos',
            importance: notif.AndroidImportance.LOW,
            sound: null,
            vibrationPattern: null,
            enableLights: false,
            enableVibrate: false,
            showBadge: false,
          });

          notif.setNotificationHandler({
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
            notif.addNotificationResponseReceivedListener((response) => {
              if (response.actionIdentifier === 'stop_recording') {
                callbacks.onStopRecording?.();
              }
            });
        } catch (error) {
          console.warn(
            'Failed to initialize notifications - recording will work without status bar indicator:',
            error
          );
        }
      }
    } else if (Platform.OS === 'ios') {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
      });
    }
  };

  const setOnStopRecordingCallback = (callback: () => void): void => {
    callbacks.onStopRecording = callback;
  };

  const updateRecordingState = (isRecording: boolean): void => {
    if (
      isServiceRunning &&
      Platform.OS === 'android' &&
      notificationId &&
      notificationsAvailable
    ) {
      updateNotification(isRecording);
    }
  };

  const updateNotification = async (isRecording: boolean): Promise<void> => {
    if (!notificationsAvailable || !Notifications) return;

    if (notificationId) {
      try {
        await Notifications.dismissNotificationAsync(notificationId);
      } catch (error) {
        console.warn('Error dismissing notification:', error);
      }

      try {
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
        console.warn('Error scheduling notification:', error);
      }
    }
  };

  const startBackgroundService = async (): Promise<boolean> => {
    if (isServiceRunning) {
      return true;
    }

    if (Platform.OS === 'android' && notificationsAvailable && Notifications) {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status === 'granted') {
          await Notifications.setNotificationCategoryAsync('recording', [
            {
              identifier: 'stop_recording',
              buttonTitle: 'Stop Recording',
              options: {
                opensAppToForeground: false,
              },
            },
          ]);

          notificationId = await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Echos - Recording',
              body: 'Tap to return to the app',
              priority: Notifications.AndroidNotificationPriority.LOW,
              categoryIdentifier: 'recording',
              sticky: true,
            },
            trigger: null,
          });
        }
      } catch (error) {
        console.warn('Could not show recording notification:', error);
      }
    }

    isServiceRunning = true;
    return true;
  };

  const stopBackgroundService = async (): Promise<boolean> => {
    if (!isServiceRunning) {
      return true;
    }

    if (notificationId && notificationsAvailable && Notifications) {
      try {
        await Notifications.dismissNotificationAsync(notificationId);
      } catch (error) {
        console.warn('Could not dismiss recording notification:', error);
      }
      notificationId = null;
    }

    isServiceRunning = false;
    return true;
  };

  return {
    initialize,
    setOnStopRecordingCallback,
    updateRecordingState,
    startBackgroundService,
    stopBackgroundService,
  };
};

export const backgroundRecordingService = createBackgroundRecordingService();
export default backgroundRecordingService;
