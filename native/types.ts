// --- AES-GCM Crypto (react-native-aes-gcm-crypto) ---

export interface EncryptResult {
  iv: string;
  content: string;
  tag: string;
}

export interface IAesGcmCrypto {
  encrypt(plainText: string, aad: boolean, key: string): Promise<EncryptResult>;
  decrypt(
    content: string,
    key: string,
    iv: string,
    tag: string,
    aad: boolean,
  ): Promise<string>;
}

// --- Aggregate ---

export interface NativeModules {
  aesGcmCrypto: IAesGcmCrypto;
}
