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
  /** When true (default), the keyboard plays a light haptic on each key
   *  press. */
  hapticFeedback: boolean;
  /** When true (default), the keyboard plays a key-click sound on each key
   *  press. On iOS the click also requires Full Access. */
  keySound: boolean;
  /** How long (seconds) a keyboard voice-typing session stays armed in the
   *  background after the user starts it from an external app. iOS forbids the
   *  extension from recording, so the main app captures on its behalf and must
   *  stay resident for this window. `0` = Off (no background session). Read by
   *  the iOS main-app transcription listener to size the session timer. */
  micTimeoutSeconds: number;
  /** When true, the keyboard blends the on-device language model's
   *  sentence-context evidence into autocorrect ranking (requires the
   *  downloaded keyboard LM; default off). */
  contextAwareAutocorrect: boolean;
  /** How strongly LM evidence weighs against the classical score (0…2). */
  lmStrength: number;
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
    {
      autocorrect: config.autocorrect,
      hapticFeedback: config.hapticFeedback,
      keySound: config.keySound,
      micTimeoutSeconds: config.micTimeoutSeconds,
      contextAwareAutocorrect: config.contextAwareAutocorrect,
      lmStrength: config.lmStrength,
    },
    { flag: FeatureFlag.settings, label: "keyboard settings" },
  );
};
