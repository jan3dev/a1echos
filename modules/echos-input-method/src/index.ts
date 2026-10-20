import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

interface NativeShape {
  /** The Echos IME id, as Settings keys its row. */
  imeId: string;
  /** Whether Echos is turned on in the system keyboard list. */
  isEnabled(): boolean;
  /** Whether Echos is the current system keyboard. */
  isSelected(): boolean;
  /** Opens the system keyboard picker. Must follow a tap in the app. */
  showPicker(): Promise<void>;
}

export const EchosInputMethod: NativeShape | null =
  Platform.OS === "android"
    ? requireOptionalNativeModule<NativeShape>("EchosInputMethod")
    : null;
