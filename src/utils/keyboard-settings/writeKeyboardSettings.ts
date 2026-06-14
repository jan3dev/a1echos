import { writeJsonAtomic } from "../file/writeJsonAtomic";
import { FeatureFlag } from "../log/log";

/**
 * File name read by the Echos keyboard's `KeyboardSettings` on both platforms.
 * On Android the IME reads it directly from the app's files dir; on iOS the
 * main-app transcription listener mirrors it into the App Group container (the
 * extension can't read the app sandbox). Kept in sync with those templates.
 */
const KEYBOARD_SETTINGS_FILENAME = "keyboard-settings.json";

export interface KeyboardSettingsConfig {
  /** When true, the keyboard auto-applies the top spelling guess on space
   *  (with backspace-revert). When false, suggestions are tap-only. */
  autocorrect: boolean;
  /** When true, the keyboard plays a light haptic on each key press. When
   *  false (default), it's silent — matching the iOS native default. */
  hapticFeedback: boolean;
}

/**
 * Writes the keyboard settings JSON so the native keyboards can read the
 * user's preferences. Atomic (stage to a tmp sibling, then move into place) so
 * the IME never parses a half-written file. Fire-and-forget — errors are logged
 * and never propagate.
 */
export const writeKeyboardSettings = (config: KeyboardSettingsConfig): void => {
  writeJsonAtomic(
    KEYBOARD_SETTINGS_FILENAME,
    { autocorrect: config.autocorrect, hapticFeedback: config.hapticFeedback },
    { flag: FeatureFlag.settings, label: "keyboard settings" },
  );
};
