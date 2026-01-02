import { setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

import { FeatureFlag, logError } from '@/utils';

const createAudioSessionService = () => {
  let configurationPromise: Promise<void> | null = null;

  const ensureRecordingMode = async (): Promise<boolean> => {
    if (Platform.OS !== 'ios') {
      return true;
    }

    // Wait for any pending configuration, but don't let a previous failure block us
    if (configurationPromise) {
      try {
        await configurationPromise;
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.service,
          message: 'Previous audio session configuration failed, retrying',
        });
        configurationPromise = null;
      }
    }

    const configure = async (): Promise<void> => {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        allowsBackgroundRecording: true,
      });
    };

    configurationPromise = configure();

    try {
      await configurationPromise;
      return true;
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.service,
        message: 'Failed to configure audio session for recording',
      });
      return false;
    } finally {
      configurationPromise = null;
    }
  };

  return {
    ensureRecordingMode,
  };
};

export const audioSessionService = createAudioSessionService();
export default audioSessionService;
