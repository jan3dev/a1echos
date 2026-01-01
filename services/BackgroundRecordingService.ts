import { setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

interface BackgroundRecordingCallbacks {
  onStopRecording?: () => void;
}

const createBackgroundRecordingService = () => {
  let isServiceRunning: boolean = false;
  const callbacks: BackgroundRecordingCallbacks = {};

  const initialize = async (): Promise<void> => {
    if (Platform.OS === 'ios') {
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

  const startBackgroundService = async (): Promise<boolean> => {
    if (isServiceRunning) {
      return true;
    }
    isServiceRunning = true;
    return true;
  };

  const stopBackgroundService = async (): Promise<boolean> => {
    if (!isServiceRunning) {
      return true;
    }
    isServiceRunning = false;
    return true;
  };

  return {
    initialize,
    setOnStopRecordingCallback,
    startBackgroundService,
    stopBackgroundService,
  };
};

export const backgroundRecordingService = createBackgroundRecordingService();
export default backgroundRecordingService;
