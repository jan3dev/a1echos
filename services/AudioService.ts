import { EventEmitter } from 'events';

import {
  AudioModule,
  AudioRecorder,
  RecordingOptions,
  setAudioModeAsync,
} from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
// @ts-ignore - module declaration exists but types are incomplete
import AudioRecord from '@fugood/react-native-audio-pcm-stream';

import { AppConstants } from '@/constants';
import {
  createPcmStreamWriter,
  FeatureFlag,
  logError,
  logWarn,
  PcmStreamWriter,
} from '@/utils';

import { permissionService } from './PermissionService';

const RECORDING_OPTIONS: RecordingOptions = {
  extension: '.wav',
  sampleRate: AppConstants.AUDIO_SAMPLE_RATE,
  numberOfChannels: AppConstants.AUDIO_NUM_CHANNELS,
  bitRate: AppConstants.AUDIO_BIT_RATE,
  isMeteringEnabled: true,
  android: {
    extension: '.wav',
    outputFormat: 'default',
    audioEncoder: 'default',
    sampleRate: AppConstants.AUDIO_SAMPLE_RATE,
  },
  ios: {
    outputFormat: 'lpcm',
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
  let recordStart: Date | null = null;

  const audioLevelEmitter = new EventEmitter();
  let amplitudeIntervalId: ReturnType<typeof setInterval> | null = null;

  let smoothedLevel: number = 0.0;
  let lastUpdateTime: Date | null = null;

  // Android native PCM recording state
  let androidPcmRecording: boolean = false;
  let androidWavFilePath: string | null = null;
  let pcmStreamWriter: PcmStreamWriter | null = null;

  // iOS audio warm-up state (once per app launch)
  let iosAudioWarmedUp: boolean = false;

  const resetLevelState = (): void => {
    smoothedLevel = 0.0;
    lastUpdateTime = null;
  };

  const emitVisual = (level: number): void => {
    audioLevelEmitter.emit('audioLevel', level);
  };

  const computeRmsFromBase64Pcm = (base64Data: string): number => {
    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      if (len < 2) return 0;

      let sumSquares = 0;
      const samples = Math.floor(len / 2);

      for (let i = 0; i < len - 1; i += 2) {
        const low = binaryString.charCodeAt(i);
        const high = binaryString.charCodeAt(i + 1);
        let sample = low | (high << 8);
        if (sample >= 32768) {
          sample -= 65536;
        }
        const normalized = sample / 32768;
        sumSquares += normalized * normalized;
      }

      const rms = Math.sqrt(sumSquares / samples);
      const boosted = Math.min(1.0, rms * 8);
      return Math.pow(boosted, 0.7);
    } catch {
      return 0;
    }
  };

  const handleAndroidPcmData = (base64Data: string): void => {
    pcmStreamWriter?.write(base64Data);

    const rawLevel = computeRmsFromBase64Pcm(base64Data);
    const level = Math.max(0.02, Math.min(1.0, rawLevel));

    const now = new Date();
    const dtMs =
      lastUpdateTime === null
        ? 16
        : Math.max(0, Math.min(150, now.getTime() - lastUpdateTime.getTime()));
    lastUpdateTime = now;

    const rising = level > smoothedLevel;
    const baseAlpha = rising ? 0.8 : 0.5;
    const alpha = Math.max(
      0.4,
      Math.min(rising ? 0.9 : 0.6, baseAlpha * (dtMs / 16.0))
    );

    smoothedLevel = smoothedLevel + (level - smoothedLevel) * alpha;
    const visual = Math.max(0.02, Math.min(1.0, smoothedLevel));
    emitVisual(visual);
  };

  const handleAmplitudeEvent = (metering: number | undefined): void => {
    let level = 0.02;

    if (metering !== undefined && isFinite(metering) && metering > -160) {
      const db = Math.max(-50.0, Math.min(0.0, metering));
      level = (db + 50.0) / 50.0;
      level = Math.max(0.0, Math.min(1.0, level));
      level = Math.pow(level, 0.6);
      level = Math.max(0.02, Math.min(1.0, level));
    }

    const now = new Date();
    const dtMs =
      lastUpdateTime === null
        ? 16
        : Math.max(0, Math.min(150, now.getTime() - lastUpdateTime.getTime()));
    lastUpdateTime = now;

    const rising = level > smoothedLevel;
    const baseAlpha = rising ? 0.8 : 0.5;
    const alpha = Math.max(
      0.4,
      Math.min(rising ? 0.9 : 0.6, baseAlpha * (dtMs / 16.0))
    );

    smoothedLevel = smoothedLevel + (level - smoothedLevel) * alpha;
    const visual = Math.max(0.02, Math.min(1.0, smoothedLevel));
    emitVisual(visual);
  };

  const startAmplitudeMonitoring = (): void => {
    if (amplitudeIntervalId) {
      clearInterval(amplitudeIntervalId);
    }

    resetLevelState();

    amplitudeIntervalId = setInterval(() => {
      if (recorder) {
        try {
          const status = recorder.getStatus();
          if (status.isRecording) {
            if (status.metering !== undefined && status.metering !== null) {
              handleAmplitudeEvent(status.metering);
            }
          }
        } catch (error) {
          logError(error, {
            flag: FeatureFlag.recording,
            message: 'Error getting amplitude',
          });
        }
      }
    }, 16);
  };

  const cleanup = async (): Promise<void> => {
    if (androidPcmRecording) {
      try {
        await AudioRecord.stop();
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.recording,
          message: 'Error stopping Android PCM recording during cleanup',
        });
      }
      if (pcmStreamWriter) {
        await pcmStreamWriter.abort();
        pcmStreamWriter = null;
      }
      androidPcmRecording = false;
      androidWavFilePath = null;
    }

    if (recorder) {
      try {
        await recorder.stop();
        recorder.release();
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.recording,
          message: 'Error during cleanup',
        });
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

  const createRecorder = (): AudioRecorder => {
    return new (
      AudioModule as {
        AudioRecorder: new (options: RecordingOptions) => AudioRecorder;
      }
    ).AudioRecorder(RECORDING_OPTIONS);
  };

  const startRecording = async (): Promise<boolean> => {
    if (!(await permissionService.ensureRecordPermission())) {
      return false;
    }

    await cleanup();

    // On Android, use native PCM streaming
    if (Platform.OS === 'android') {
      try {
        const timestamp = Date.now();
        const wavPath = `${Paths.cache.uri}/rec_${timestamp}.wav`;
        androidWavFilePath = wavPath.replace('file://', '');

        resetLevelState();
        pcmStreamWriter = createPcmStreamWriter(
          androidWavFilePath,
          AppConstants.AUDIO_SAMPLE_RATE,
          AppConstants.AUDIO_NUM_CHANNELS,
          16
        );

        AudioRecord.init({
          sampleRate: AppConstants.AUDIO_SAMPLE_RATE,
          channels: AppConstants.AUDIO_NUM_CHANNELS,
          bitsPerSample: 16,
          audioSource: 6, // VOICE_RECOGNITION
          bufferSize: 4096,
        });

        AudioRecord.on('data', handleAndroidPcmData);
        AudioRecord.start();
        androidPcmRecording = true;
        recordStart = new Date();

        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {
          logWarn('Haptics not supported', { flag: FeatureFlag.recording });
        }

        return true;
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.recording,
          message: 'Error starting Android PCM recording',
        });
        if (pcmStreamWriter) {
          await pcmStreamWriter.abort();
          pcmStreamWriter = null;
        }
        androidPcmRecording = false;
        androidWavFilePath = null;
        return false;
      }
    }

    // iOS uses expo-audio
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        allowsBackgroundRecording: true,
      });

      recorder = createRecorder();

      await recorder.prepareToRecordAsync();
      recorder.record();
      recordStart = new Date();

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        logWarn('Haptics not supported', { flag: FeatureFlag.recording });
      }

      startAmplitudeMonitoring();

      return true;
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.recording,
        message: 'Error starting recording',
      });
      try {
        if (recorder) {
          await recorder.stop();
          recorder.release();
        }
      } catch {}
      return false;
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    // Handle Android native PCM recording
    if (Platform.OS === 'android' && androidPcmRecording) {
      try {
        const startedAt = recordStart || new Date();
        const elapsedMs = new Date().getTime() - startedAt.getTime();
        const minMs = 250;
        const waitMs = elapsedMs >= minMs ? 0 : minMs - elapsedMs;

        if (waitMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }

        AudioRecord.stop();
        androidPcmRecording = false;

        try {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          );
        } catch {
          logWarn('Haptics not supported', { flag: FeatureFlag.recording });
        }

        if (androidWavFilePath && pcmStreamWriter) {
          const byteCount = pcmStreamWriter.getByteCount();
          const success = await pcmStreamWriter.finalize();
          pcmStreamWriter = null;

          if (success) {
            const wavFilePath = `file://${androidWavFilePath}`;
            const file = new File(wavFilePath);
            if (file.exists && file.size > 1024) {
              recordStart = null;
              currentAudioFile = wavFilePath;
              androidWavFilePath = null;
              return wavFilePath;
            } else {
              logError('WAV file validation failed after write', {
                flag: FeatureFlag.recording,
                message: `File exists: ${file.exists}, size: ${file.size}`,
              });
            }
          } else {
            logError('Failed to finalize WAV file from PCM stream', {
              flag: FeatureFlag.recording,
              message: `Bytes: ${byteCount}, path: ${androidWavFilePath}`,
            });
          }
        }

        recordStart = null;
        androidWavFilePath = null;
        pcmStreamWriter = null;
        return null;
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.recording,
          message: 'Error stopping Android PCM recording',
        });
        if (pcmStreamWriter) {
          await pcmStreamWriter.abort();
          pcmStreamWriter = null;
        }
        androidPcmRecording = false;
        androidWavFilePath = null;
        recordStart = null;
        return null;
      }
    }

    // iOS
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
      logError(error, {
        flag: FeatureFlag.recording,
        message: 'Error calculating recording duration',
      });
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
          logWarn('Haptics not supported', { flag: FeatureFlag.recording });
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

  const subscribeToAudioLevel = (
    callback: (level: number) => void
  ): (() => void) => {
    audioLevelEmitter.on('audioLevel', callback);
    return () => {
      audioLevelEmitter.off('audioLevel', callback);
    };
  };

  const dispose = async (): Promise<void> => {
    try {
      if (amplitudeIntervalId) {
        clearInterval(amplitudeIntervalId);
        amplitudeIntervalId = null;
      }

      if (androidPcmRecording) {
        try {
          await AudioRecord.stop();
        } catch {}
        if (pcmStreamWriter) {
          await pcmStreamWriter.abort();
          pcmStreamWriter = null;
        }
        androidPcmRecording = false;
        androidWavFilePath = null;
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

  const warmUpIosAudioInput = async (): Promise<boolean> => {
    if (Platform.OS !== 'ios') {
      return true;
    }

    if (iosAudioWarmedUp) {
      return true;
    }

    if (recorder) {
      iosAudioWarmedUp = true;
      return true;
    }

    let warmupRecorder: AudioRecorder | null = null;

    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
      });

      warmupRecorder = createRecorder();
      await warmupRecorder.prepareToRecordAsync();

      warmupRecorder.record();
      await new Promise((resolve) => setTimeout(resolve, 50));
      await warmupRecorder.stop();

      const uri = warmupRecorder.uri;
      warmupRecorder.release();
      warmupRecorder = null;

      if (uri) {
        try {
          const file = new File(uri);
          if (file.exists) {
            file.delete();
          }
        } catch {}
      }

      iosAudioWarmedUp = true;
      return true;
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.recording,
        message: 'iOS audio warm-up failed',
      });

      if (warmupRecorder) {
        try {
          warmupRecorder.release();
        } catch {}
      }

      return false;
    }
  };

  return {
    startRecording,
    stopRecording,
    subscribeToAudioLevel,
    dispose,
    warmUpIosAudioInput,
  };
};

export const audioService = createAudioService();
export default audioService;
