import { File, Paths } from "expo-file-system";

import { FeatureFlag, logWarn } from "../log/log";

/**
 * File the iOS main-app transcription listener writes (via
 * `markOpenedFromKeyboard`) when the app is opened from the keyboard's
 * `echos://voice-session` deep link. JS reads it on foreground to show the
 * "swipe back to your app" hint. Filename kept in sync with the Swift template.
 */
const KEYBOARD_LAUNCH_FILENAME = "keyboard-launch.json";

export interface KeyboardLaunchMarker {
  /** Epoch milliseconds when the app was opened from the keyboard. */
  openedAt: number;
}

/**
 * Reads the keyboard-launch marker, or `null` when absent/unreadable. Never
 * throws — a missing or malformed file just yields `null`.
 */
export const readKeyboardLaunchMarker =
  async (): Promise<KeyboardLaunchMarker | null> => {
    try {
      const file = new File(Paths.document, KEYBOARD_LAUNCH_FILENAME);
      if (!file.exists) return null;
      const parsed = JSON.parse(await file.text()) as { openedAt?: unknown };
      if (typeof parsed?.openedAt === "number") {
        return { openedAt: parsed.openedAt };
      }
      return null;
    } catch (error) {
      logWarn(`Failed to read keyboard launch marker: ${error}`, {
        flag: FeatureFlag.settings,
      });
      return null;
    }
  };

/** Deletes the marker so the hint isn't shown again. Never throws. */
export const clearKeyboardLaunchMarker = (): void => {
  try {
    const file = new File(Paths.document, KEYBOARD_LAUNCH_FILENAME);
    if (file.exists) file.delete();
  } catch (error) {
    logWarn(`Failed to clear keyboard launch marker: ${error}`, {
      flag: FeatureFlag.settings,
    });
  }
};
