import { useCallback } from 'react';
import { useTranscriptionStore } from '../stores/transcriptionStore';
import { usePermissions } from './usePermissions';

export const useRecording = () => {
  const { hasPermission, requestPermission, canAskAgain, openSettings } =
    usePermissions();

  const isRecording = useTranscriptionStore((state) => state.isRecording());
  const isLoading = useTranscriptionStore((state) => state.isLoading());
  const startRecordingAction = useTranscriptionStore(
    (state) => state.startRecording
  );
  const stopRecordingAction = useTranscriptionStore(
    (state) => state.stopRecordingAndSave
  );
  const setError = useTranscriptionStore((state) => state.setError);

  const startRecording = useCallback(async () => {
    if (isLoading) return false;

    // 1. Check permissions
    if (!hasPermission) {
      if (canAskAgain) {
        const granted = await requestPermission();
        if (!granted) {
          setError('Microphone permission is required to record.');
          return false;
        }
      } else {
        // Permanently denied
        setError(
          'Microphone permission is denied. Please enable it in settings.'
        );
        // Optionally trigger openSettings() or let UI handle it
        return false;
      }
    }

    // 2. Start recording
    const success = await startRecordingAction();
    return success;
  }, [
    hasPermission,
    canAskAgain,
    requestPermission,
    isLoading,
    startRecordingAction,
    setError,
  ]);

  const stopRecording = useCallback(async () => {
    if (!isRecording) return;
    try {
      await stopRecordingAction();
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setError('Failed to stop recording.');
      return false;
    }
  }, [isRecording, setError, stopRecordingAction]);

  return {
    isRecording,
    isLoading,
    canRecord: hasPermission && !isRecording && !isLoading,
    startRecording,
    stopRecording,
    hasPermission, // Re-export for convenience
    openSettings, // Re-export for convenience
  };
};
