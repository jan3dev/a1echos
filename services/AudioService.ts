import {
  AudioModule,
  AudioRecorder,
  getRecordingPermissionsAsync,
  PermissionStatus,
  RecordingOptions,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { NativeEventEmitter } from 'react-native';
import { AppConstants } from '../constants/AppConstants';
import { backgroundRecordingService } from './BackgroundRecordingService';

const RECORDING_OPTIONS: RecordingOptions = {
  extension: '.wav',
  sampleRate: AppConstants.AUDIO_SAMPLE_RATE,
  numberOfChannels: AppConstants.AUDIO_NUM_CHANNELS,
  bitRate: AppConstants.AUDIO_BIT_RATE,
  isMeteringEnabled: true,
  android: {
    outputFormat: 'default',
    audioEncoder: 'default',
    sampleRate: AppConstants.AUDIO_SAMPLE_RATE,
  },
  ios: {
    outputFormat: 'linearpcm',
    audioQuality: 127, // AudioQuality.MAX
    sampleRate: AppConstants.AUDIO_SAMPLE_RATE,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/wav',
    bitsPerSecond: AppConstants.AUDIO_BIT_RATE,
  },
};

const createAudioService = () => {
  let recorder: AudioRecorder | null = null;
  let currentAudioFile: string | null = null;
  let isMonitoring: boolean = false;
  let monitorTempPath: string | null = null;
  let recordStart: Date | null = null;

  const audioLevelEmitter = new NativeEventEmitter();
  let amplitudeIntervalId: ReturnType<typeof setInterval> | null = null;

  let smoothedLevel: number = 0.0;
  let lastUpdateTime: Date | null = null;

  let backgroundServiceInitialized: boolean = false;

  const hasPermission = async (): Promise<boolean> => {
    try {
      const { status } = await getRecordingPermissionsAsync();

      if (status === PermissionStatus.GRANTED) {
        return true;
      }

      const { granted } = await requestRecordingPermissionsAsync();
      return granted;
    } catch (error) {
      console.error('Error checking microphone permission:', error);
      return false;
    }
  };

  const isPermanentlyDenied = async (): Promise<boolean> => {
    try {
      const { status, canAskAgain } = await getRecordingPermissionsAsync();
      return status === PermissionStatus.DENIED && !canAskAgain;
    } catch (error) {
      console.error('Error checking permission denial status:', error);
      return false;
    }
  };

  const generateRecordingPath = async (
    extension: string = 'wav'
  ): Promise<string> => {
    const timestamp = Date.now();
    const filename = `rec_${timestamp}.${extension}`;
    return new File(Paths.cache, filename).uri;
  };

  const resetLevelState = (): void => {
    smoothedLevel = 0.0;
    lastUpdateTime = null;
  };

  const emitVisual = (level: number): void => {
    audioLevelEmitter.emit('audioLevel', level);
  };

  const handleAmplitudeEvent = (metering: number | undefined): void => {
    let level = 0.02;

    if (metering !== undefined && isFinite(metering) && metering > -160) {
      const db = Math.max(-60.0, Math.min(-10.0, metering));
      level = (db - -60.0) / (-10.0 - -60.0);
      level = Math.max(0.0, Math.min(1.0, level));

      level = level * level;
      level = Math.max(0.02, Math.min(1.0, level));
    }

    const now = new Date();
    const dtMs =
      lastUpdateTime === null
        ? 16
        : Math.max(0, Math.min(150, now.getTime() - lastUpdateTime.getTime()));
    lastUpdateTime = now;

    const rising = level > smoothedLevel;
    const baseAlpha = rising ? 0.6 : 0.2;
    const alpha = Math.max(
      0.2,
      Math.min(rising ? 0.8 : 0.3, baseAlpha * (dtMs / 16.0))
    );

    smoothedLevel = smoothedLevel + (level - smoothedLevel) * alpha;

    const visual = Math.max(0.02, Math.min(1.0, smoothedLevel));
    emitVisual(visual);
  };

  const startAmplitudeMonitoring = (): void => {
    if (amplitudeIntervalId) {
      clearInterval(amplitudeIntervalId);
    }

    amplitudeIntervalId = setInterval(() => {
      if (recorder) {
        try {
          const status = recorder.getStatus();
          if (status.isRecording && status.metering !== undefined) {
            handleAmplitudeEvent(status.metering);
          }
        } catch (error) {
          console.error('Error getting amplitude:', error);
        }
      }
    }, 16);
  };

  const cleanup = async (): Promise<void> => {
    if (recorder) {
      try {
        await recorder.stop();
        recorder.release();
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
      recorder = null;
    }

    if (amplitudeIntervalId) {
      clearInterval(amplitudeIntervalId);
      amplitudeIntervalId = null;
    }

    currentAudioFile = null;
    resetLevelState();
  };

  // Note: expo-audio's public API only provides useAudioRecorder hook for creating recorders.
  // Since this is a service (not a React component), we access AudioModule.AudioRecorder directly.
  // This mirrors the internal implementation of useAudioRecorder in expo-audio.
  // If expo-audio adds a createAudioRecorder factory function in the future, prefer that.
  const createRecorder = (): AudioRecorder => {
    return new (
      AudioModule as {
        AudioRecorder: new (options: RecordingOptions) => AudioRecorder;
      }
    ).AudioRecorder(RECORDING_OPTIONS);
  };

  const startRecording = async (): Promise<boolean> => {
    if (!(await hasPermission())) {
      return false;
    }

    if (!backgroundServiceInitialized) {
      try {
        await backgroundRecordingService.initialize();

        backgroundRecordingService.setOnStopRecordingCallback(async () => {
          await stopRecording();
        });

        backgroundServiceInitialized = true;
      } catch (error) {
        console.error('Background service initialization failed:', error);
      }
    }

    try {
      const success = await backgroundRecordingService.startBackgroundService();
      if (!success) {
        console.error('Background service failed to start');
      }
    } catch (error) {
      console.error('Failed to start background service:', error);
    }

    await cleanup();

    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
      });

      recorder = createRecorder();

      await recorder.prepareToRecordAsync();
      recorder.record();
      recordStart = new Date();

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        console.warn('Haptics not supported');
      }

      startAmplitudeMonitoring();

      return true;
    } catch (error) {
      console.error('Error starting recording:', error);
      try {
        if (recorder) {
          await recorder.stop();
          recorder.release();
        }
      } catch {}
      return false;
    }
  };

  const startMonitoring = async (): Promise<boolean> => {
    if (!(await hasPermission())) {
      return false;
    }

    if (recorder) {
      return true;
    }

    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      monitorTempPath = await generateRecordingPath();

      recorder = createRecorder();

      await recorder.prepareToRecordAsync();
      recorder.record();
      isMonitoring = true;

      startAmplitudeMonitoring();

      return true;
    } catch (error) {
      console.error('Error starting monitoring:', error);
      return false;
    }
  };

  const stopMonitoring = async (): Promise<void> => {
    if (!isMonitoring) return;

    try {
      if (recorder) {
        await recorder.stop();
        recorder.release();
        recorder = null;
      }
    } catch (error) {
      console.error('Error stopping monitoring:', error);
    }

    if (amplitudeIntervalId) {
      clearInterval(amplitudeIntervalId);
      amplitudeIntervalId = null;
    }

    isMonitoring = false;

    if (monitorTempPath) {
      try {
        const file = new File(monitorTempPath);
        if (file.exists) {
          file.delete();
        }
      } catch {}
      monitorTempPath = null;
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    backgroundRecordingService.updateRecordingState(false);

    try {
      await backgroundRecordingService.stopBackgroundService();
    } catch (error) {
      console.error('Failed to stop background service:', error);
    }

    const isCurrentlyRecording = recorder !== null;

    if (!isCurrentlyRecording) {
      if (amplitudeIntervalId) {
        clearInterval(amplitudeIntervalId);
        amplitudeIntervalId = null;
      }
      return currentAudioFile;
    }

    try {
      const startedAt = recordStart || new Date();
      const elapsedMs = new Date().getTime() - startedAt.getTime();
      const minMs = 250;
      const waitMs = elapsedMs >= minMs ? 0 : minMs - elapsedMs;

      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    } catch (error) {
      console.error('Error calculating recording duration:', error);
    }

    let recordedFilePath: string | null = null;

    try {
      if (recorder) {
        await recorder.stop();

        const uri = recorder.uri;

        try {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          );
        } catch {
          console.warn('Haptics not supported');
        }
        if (uri) {
          const file = new File(uri);
          if (file.exists) {
            const info = file.size;
            if (info > 1024) {
              recordedFilePath = uri;
            }
          }
        }

        recorder.release();
      }
    } catch {
      recordedFilePath = null;
    }

    if (amplitudeIntervalId) {
      clearInterval(amplitudeIntervalId);
      amplitudeIntervalId = null;
    }

    recorder = null;
    recordStart = null;
    currentAudioFile = recordedFilePath;

    return recordedFilePath;
  };

  const isRecording = async (): Promise<boolean> => {
    if (!recorder) {
      return false;
    }

    try {
      const status = recorder.getStatus();
      return status.isRecording;
    } catch {
      return false;
    }
  };

  const subscribeToAudioLevel = (
    callback: (level: number) => void
  ): (() => void) => {
    const subscription = audioLevelEmitter.addListener('audioLevel', callback);
    return () => {
      subscription.remove();
    };
  };

  const dispose = async (): Promise<void> => {
    try {
      if (amplitudeIntervalId) {
        clearInterval(amplitudeIntervalId);
        amplitudeIntervalId = null;
      }

      if (recorder) {
        await recorder.stop();
        recorder.release();
        recorder = null;
      }
    } catch {}

    try {
      audioLevelEmitter.removeAllListeners('audioLevel');
    } catch {}
  };

  return {
    hasPermission,
    isPermanentlyDenied,
    startRecording,
    startMonitoring,
    stopMonitoring,
    stopRecording,
    isRecording,
    subscribeToAudioLevel,
    dispose,
  };
};

export const audioService = createAudioService();
export default audioService;
