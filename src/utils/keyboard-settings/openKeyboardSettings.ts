import { Linking, Platform } from "react-native";

import { EchosInputMethod } from "@modules/echos-input-method/src";

import { FeatureFlag, logError } from "../log/log";

const ANDROID_INPUT_METHOD_SETTINGS = "android.settings.INPUT_METHOD_SETTINGS";
// AOSP Settings scrolls to and highlights the preference with this key.
const ANDROID_HIGHLIGHT_KEY = ":settings:fragment_args_key";

export const openKeyboardSettings = async (): Promise<boolean> => {
  try {
    if (Platform.OS === "android") {
      const imeId = EchosInputMethod?.imeId;
      await Linking.sendIntent(
        ANDROID_INPUT_METHOD_SETTINGS,
        imeId ? [{ key: ANDROID_HIGHLIGHT_KEY, value: imeId }] : undefined,
      );
      return true;
    }
    await Linking.openSettings();
    return true;
  } catch (error) {
    logError(error, {
      flag: FeatureFlag.settings,
      message: "Failed to open keyboard settings",
    });
    return false;
  }
};

/** Android: opens the system keyboard picker. Call only from a tap. */
export const showKeyboardPicker = async (): Promise<void> => {
  try {
    await EchosInputMethod?.showPicker();
  } catch (error) {
    logError(error, {
      flag: FeatureFlag.settings,
      message: "Failed to show keyboard picker",
    });
  }
};
