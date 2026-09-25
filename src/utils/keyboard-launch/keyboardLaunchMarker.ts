import { File, Paths } from "expo-file-system";

import { FeatureFlag, logWarn } from "../log/log";

/**
 * File the iOS main-app transcription listener writes (via
 * `markOpenedFromKeyboard`) when the app is opened from the keyboard's
 * `echos://voice-session` deep link. JS reads it on foreground to show the
 * "swipe back to your app" hint. Filename kept in sync with the Swift template.
 */
const KEYBOARD_LAUNCH_FILENAME = "keyboard-launch.json";
const KEYBOARD_SHOWN_FILENAME = "keyboard-shown.json";

export interface KeyboardLaunchMarker {
  /** Epoch milliseconds when the app was opened from the keyboard. */
  openedAt: number;
}

/** Epoch ms stored under `key` in a Documents marker file, or `null`. Never throws. */
const readMarkerTimestamp = async (
  filename: string,
  key: string,
  onError?: (error: unknown) => void,
): Promise<number | null> => {
  try {
    const file = new File(Paths.document, filename);
    if (!file.exists) return null;
    const value = (JSON.parse(await file.text()) as Record<string, unknown>)?.[
      key
    ];
    return typeof value === "number" ? value : null;
  } catch (error) {
    onError?.(error);
    return null;
  }
};

/**
 * Reads the keyboard-launch marker, or `null` when absent/unreadable. Never
 * throws — a missing or malformed file just yields `null`.
 */
export const readKeyboardLaunchMarker =
  async (): Promise<KeyboardLaunchMarker | null> => {
    const openedAt = await readMarkerTimestamp(
      KEYBOARD_LAUNCH_FILENAME,
      "openedAt",
      (error) =>
        logWarn(`Failed to read keyboard launch marker: ${error}`, {
          flag: FeatureFlag.settings,
        }),
    );
    return openedAt === null ? null : { openedAt };
  };

/**
 * Epoch ms the Echos keyboard last appeared (written by the iOS main-app
 * listener, or the Android IME directly), or `null`. Silent: it is polled, and
 * a missing file is the normal case.
 */
export const readKeyboardShownAt = () =>
  readMarkerTimestamp(KEYBOARD_SHOWN_FILENAME, "shownAt");

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
