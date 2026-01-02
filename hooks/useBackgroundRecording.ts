import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

import { audioSessionService } from '@/services';
import { useTranscriptionStore } from '@/stores';
import { FeatureFlag, logError, logWarn } from '@/utils';

export const useBackgroundRecording = () => {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;

      // Only handle iOS foreground transitions
      if (Platform.OS !== 'ios') {
        return;
      }

      // App came to foreground
      if (
        (previousState === 'background' || previousState === 'inactive') &&
        nextAppState === 'active'
      ) {
        const transcriptionState = useTranscriptionStore.getState();
        const isRecording = transcriptionState.isRecording();
        const isStreaming = transcriptionState.isStreaming();

        // If we were recording/streaming, reassert audio session
        if (isRecording || isStreaming) {
          try {
            const success = await audioSessionService.ensureRecordingMode();
            if (!success) {
              logWarn('Failed to reassert audio session on foreground', {
                flag: FeatureFlag.service,
              });
            }
          } catch (error) {
            logError(error, {
              flag: FeatureFlag.service,
              message: 'Error reasserting audio session on foreground',
            });
          }
        }
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );

    return () => {
      subscription.remove();
    };
  }, []);
};

export default useBackgroundRecording;
