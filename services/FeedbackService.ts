import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as Haptics from "expo-haptics";

import { useSettingsStore } from "@/stores/settingsStore";
import { FeatureFlag, logWarn } from "@/utils";

export type HapticKind =
  | "selection"
  | "light"
  | "medium"
  | "heavy"
  | "rigid"
  | "soft"
  | "success"
  | "warning"
  | "error";

export type SoundKind =
  | "recStart"
  | "recStop"
  | "transcriptionComplete"
  | "error"
  | "toggle"
  | "copySuccess";

const SOUND_SOURCES: Record<SoundKind, number> = {
  recStart: require("@/assets/sounds/rec-start.wav"),
  recStop: require("@/assets/sounds/rec-stop.wav"),
  transcriptionComplete: require("@/assets/sounds/transcription-complete.wav"),
  error: require("@/assets/sounds/error.wav"),
  toggle: require("@/assets/sounds/toggle.wav"),
  copySuccess: require("@/assets/sounds/copy-success.wav"),
};

export const SOUND_KINDS = Object.keys(SOUND_SOURCES) as SoundKind[];

const createFeedbackService = () => {
  const players: Partial<Record<SoundKind, AudioPlayer>> = {};
  let initPromise: Promise<void> | null = null;
  let recordingActive = false;

  const HAPTIC_DISPATCH: Record<HapticKind, () => Promise<unknown> | void> = {
    selection: () => Haptics.selectionAsync(),
    light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
    rigid: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid),
    soft: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft),
    success: () =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    warning: () =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    error: () =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  };

  const swallow = (result: Promise<unknown> | void, kind: HapticKind): void => {
    if (result instanceof Promise) {
      result.catch((error: unknown) => {
        logWarn(`Haptic rejected (${kind}): ${error}`, {
          flag: FeatureFlag.service,
        });
      });
    }
  };

  const initialize = async (): Promise<void> => {
    if (initPromise) return initPromise;

    initPromise = (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: false,
          allowsRecording: false,
          shouldPlayInBackground: false,
        });
      } catch (error) {
        logWarn(`Failed to set audio mode: ${error}`, {
          flag: FeatureFlag.service,
        });
      }

      SOUND_KINDS.forEach((kind) => {
        try {
          players[kind] = createAudioPlayer(SOUND_SOURCES[kind]);
        } catch (error) {
          logWarn(`Failed to preload sound ${kind}: ${error}`, {
            flag: FeatureFlag.service,
          });
        }
      });
    })();

    return initPromise;
  };

  const setRecordingActive = (active: boolean): void => {
    recordingActive = active;
  };

  const haptic = (kind: HapticKind): void => {
    if (!useSettingsStore.getState().isHapticsEnabled) return;

    try {
      swallow(HAPTIC_DISPATCH[kind](), kind);
    } catch (error) {
      logWarn(`Haptic failed (${kind}): ${error}`, {
        flag: FeatureFlag.service,
      });
    }
  };

  const sound = (kind: SoundKind): void => {
    const state = useSettingsStore.getState();
    if (!state.isSoundsEnabled) return;
    if (state.isIncognitoMode) return;
    if (recordingActive) return;

    const player = players[kind];
    if (!player) return;

    try {
      const seekResult = player.seekTo(0);
      if (seekResult instanceof Promise) {
        seekResult
          .then(() => player.play())
          .catch((error: unknown) => {
            logWarn(`Sound play failed (${kind}): ${error}`, {
              flag: FeatureFlag.service,
            });
          });
      } else {
        player.play();
      }
    } catch (error) {
      logWarn(`Sound play failed (${kind}): ${error}`, {
        flag: FeatureFlag.service,
      });
    }
  };

  const tap = (soundKind?: SoundKind): void => {
    haptic("selection");
    if (soundKind) {
      sound(soundKind);
    }
  };

  const dispose = (): void => {
    SOUND_KINDS.forEach((kind) => {
      const player = players[kind];
      if (player) {
        try {
          player.remove();
        } catch {}
        delete players[kind];
      }
    });
    recordingActive = false;
    initPromise = null;
  };

  return {
    initialize,
    setRecordingActive,
    haptic,
    sound,
    tap,
    dispose,
  };
};

export const feedbackService = createFeedbackService();
export default feedbackService;
