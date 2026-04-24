import AesGcmCrypto from "react-native-aes-gcm-crypto";

import type { NativeModules } from "../types/types";

export const nativeModules: NativeModules = {
  aesGcmCrypto: {
    encrypt: (plainText, aad, key) => AesGcmCrypto.encrypt(plainText, aad, key),
    decrypt: (content, key, iv, tag, aad) =>
      AesGcmCrypto.decrypt(content, key, iv, tag, aad),
  },
};
