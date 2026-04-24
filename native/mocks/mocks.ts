import type { NativeModules } from "../types/types";

const unavailable = (name: string): never => {
  throw new Error(`${name} is not available in Storybook`);
};

export const nativeModules: NativeModules = {
  aesGcmCrypto: {
    encrypt: () => unavailable("AesGcmCrypto"),
    decrypt: () => unavailable("AesGcmCrypto"),
  },
};
