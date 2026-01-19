import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { audioService } from '@/services';
import { useTranscriptionStore } from '@/stores';

export const useBackgroundRecording = () => {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;

      const transcriptionState = useTranscriptionStore.getState();
      const isRecording = transcriptionState.isRecording();

      // App going to background - pause amplitude monitoring to save resources
      if (
        previousState === 'active' &&
        (nextAppState === 'background' || nextAppState === 'inactive')
      ) {
        if (isRecording) {
          audioService.pauseAmplitudeMonitoring();
        }
      }

      // App came to foreground - resume amplitude monitoring after brief delay
      if (
        (previousState === 'background' || previousState === 'inactive') &&
        nextAppState === 'active'
      ) {
        if (isRecording) {
          setTimeout(() => {
            audioService.resumeAmplitudeMonitoring();
          }, 150);
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
