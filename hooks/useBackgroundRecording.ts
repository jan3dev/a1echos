import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

import { ModelType } from '@/models';
import { audioSessionService, whisperService } from '@/services';
import { useSettingsStore, useTranscriptionStore } from '@/stores';
import { FeatureFlag, logError, logInfo, logWarn } from '@/utils';

export const useBackgroundRecording = () => {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;

      // Only handle iOS transitions
      if (Platform.OS !== 'ios') {
        return;
      }

      const transcriptionState = useTranscriptionStore.getState();
      const settingsState = useSettingsStore.getState();
      const isRecording = transcriptionState.isRecording();
      const isStreaming = transcriptionState.isStreaming();
      const isRealtimeMode =
        settingsState.selectedModelType === ModelType.WHISPER_REALTIME;

      // App going to background or inactive
      if (
        previousState === 'active' &&
        (nextAppState === 'background' || nextAppState === 'inactive')
      ) {
        // Suspend realtime Whisper/VAD processing to avoid native crash
        if ((isRecording || isStreaming) && isRealtimeMode) {
          logInfo('Suspending realtime processing for background', {
            flag: FeatureFlag.service,
          });
          whisperService.setRealtimeProcessingSuspended(true);
        }
        return;
      }

      // App came to foreground
      if (
        (previousState === 'background' || previousState === 'inactive') &&
        nextAppState === 'active'
      ) {
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

          // Resume realtime Whisper/VAD processing
          if (isRealtimeMode && whisperService.isRealtimeRecording()) {
            logInfo('Resuming realtime processing after foreground', {
              flag: FeatureFlag.service,
            });
            whisperService.setRealtimeProcessingSuspended(false);
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
