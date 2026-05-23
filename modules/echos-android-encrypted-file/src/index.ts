import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

interface NativeShape {
  copyToEncrypted(srcPath: string, dstPath: string): Promise<void>;
  decryptToCacheFile(srcPath: string): Promise<string>;
  isEncrypted(path: string): Promise<boolean>;
  deleteFile(path: string): Promise<void>;
}

const NativeModule =
  Platform.OS === "android"
    ? requireOptionalNativeModule<NativeShape>("EchosAndroidEncryptedFile")
    : null;

export const EchosAndroidEncryptedFile: NativeShape | null = NativeModule;
