import { fromByteArray } from 'base64-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import AesGcmCrypto from 'react-native-aes-gcm-crypto';

const KEY_STORAGE_KEY = 'aes_data_key';

export class EncryptionService {
  private static instance: EncryptionService;

  private constructor() {}

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  private async getKey(): Promise<string> {
    try {
      let base64Key = await SecureStore.getItemAsync(KEY_STORAGE_KEY);

      if (!base64Key) {
        const keyBytes = await Crypto.getRandomBytesAsync(32);
        base64Key = fromByteArray(keyBytes);
        await SecureStore.setItemAsync(KEY_STORAGE_KEY, base64Key);
      }

      return base64Key;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to retrieve or generate encryption key: ${message}`
      );
    }
  }

  async encrypt(plainText: string): Promise<string> {
    try {
      const key = await this.getKey();
      const result = await AesGcmCrypto.encrypt(plainText, false, key);

      return `${result.iv}:${result.content}${result.tag}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Encryption failed: ${message}`);
    }
  }

  async decrypt(cipherText: string): Promise<string> {
    try {
      const parts = cipherText.split(':');

      if (parts.length !== 2) {
        throw new Error(
          'Invalid cipher text format. Expected format: iv:contenttag'
        );
      }

      const [iv, contentWithTag] = parts;
      const key = await this.getKey();

      const tag = contentWithTag.slice(-32);
      const content = contentWithTag.slice(0, -32);

      const decrypted = await AesGcmCrypto.decrypt(
        content,
        key,
        iv,
        tag,
        false
      );

      return decrypted;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Decryption failed: ${message}`);
    }
  }
}

export default EncryptionService.getInstance();
