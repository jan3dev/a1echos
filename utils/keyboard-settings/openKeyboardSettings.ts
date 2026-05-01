import { Linking, Platform } from "react-native";

import { FeatureFlag, logError } from "../log/log";

const ANDROID_INPUT_METHOD_SETTINGS = "android.settings.INPUT_METHOD_SETTINGS";

export const openKeyboardSettings = async (): Promise<boolean> => {
  try {
    if (Platform.OS === "android") {
      await Linking.sendIntent(ANDROID_INPUT_METHOD_SETTINGS);
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
