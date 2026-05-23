import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

export type ProtectionClass =
  | "complete"
  | "completeUnlessOpen"
  | "completeUntilFirstUserAuthentication"
  | "none";

interface NativeShape {
  setFileProtection(path: string, protection: ProtectionClass): Promise<void>;
  getFileProtection(path: string): Promise<ProtectionClass>;
  setBackupExcluded(path: string, excluded: boolean): Promise<void>;
}

const NativeModule =
  Platform.OS === "ios"
    ? requireOptionalNativeModule<NativeShape>("EchosFileProtection")
    : null;

export const EchosFileProtection: NativeShape | null = NativeModule;
