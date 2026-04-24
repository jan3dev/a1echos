import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import AesGcmCrypto from "react-native-aes-gcm-crypto";

import { encryptionService } from "./EncryptionService";

const mockGetItem = SecureStore.getItemAsync as jest.Mock;
const mockSetItem = SecureStore.setItemAsync as jest.Mock;
const mockGetRandomBytes = Crypto.getRandomBytesAsync as jest.Mock;
const mockAesEncrypt = AesGcmCrypto.encrypt as jest.Mock;
const mockAesDecrypt = AesGcmCrypto.decrypt as jest.Mock;

describe("EncryptionService", () => {
  describe("encrypt", () => {
    it("generates key on first use and stores in SecureStore", async () => {
      mockGetItem.mockResolvedValueOnce(null);

      await encryptionService.encrypt("hello");

      expect(mockGetRandomBytes).toHaveBeenCalledWith(32);
      expect(mockSetItem).toHaveBeenCalledWith(
        "aes_data_key",
        expect.any(String),
      );
    });

    it("reuses cached key from SecureStore on subsequent calls", async () => {
      mockGetItem.mockResolvedValueOnce("cached-key");

      await encryptionService.encrypt("hello");

      expect(mockGetRandomBytes).not.toHaveBeenCalled();
      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it("returns iv:contenttag format", async () => {
      mockGetItem.mockResolvedValueOnce("test-key");
      mockAesEncrypt.mockResolvedValueOnce({
        iv: "test-iv",
        content: "encrypted-data",
        tag: "-auth-tag",
      });

      const result = await encryptionService.encrypt("hello");

      expect(result).toBe("test-iv:encrypted-data-auth-tag");
    });

    it("calls AesGcmCrypto.encrypt with correct params", async () => {
      mockGetItem.mockResolvedValueOnce("the-key");

      await encryptionService.encrypt("plaintext");

      expect(mockAesEncrypt).toHaveBeenCalledWith(
        "plaintext",
        false,
        "the-key",
      );
    });

    it("throws descriptive error on AesGcmCrypto failure", async () => {
      mockGetItem.mockResolvedValueOnce("key");
      mockAesEncrypt.mockRejectedValueOnce(new Error("crypto error"));

      await expect(encryptionService.encrypt("hello")).rejects.toThrow(
        "Encryption failed: crypto error",
      );
    });

    it("throws descriptive error on key generation failure", async () => {
      mockGetItem.mockResolvedValueOnce(null);
      mockGetRandomBytes.mockRejectedValueOnce(new Error("rng failed"));

      await expect(encryptionService.encrypt("hello")).rejects.toThrow(
        "Encryption failed",
      );
    });
  });

  describe("decrypt", () => {
    it("parses iv:contenttag format correctly", async () => {
      mockGetItem.mockResolvedValueOnce("the-key");
      mockAesDecrypt.mockResolvedValueOnce("decrypted-text");

      const result = await encryptionService.decrypt(
        "test-iv:encrypted-content01234567890123456789ab",
      );

      expect(result).toBe("decrypted-text");
    });

    it("extracts last 32 chars as tag and calls AesGcmCrypto.decrypt correctly", async () => {
      mockGetItem.mockResolvedValueOnce("the-key");
      mockAesDecrypt.mockResolvedValueOnce("result");

      const tag = "01234567890123456789012345678901"; // 32 chars
      const content = "ciphertext";
      await encryptionService.decrypt(`my-iv:${content}${tag}`);

      expect(mockAesDecrypt).toHaveBeenCalledWith(
        content,
        "the-key",
        "my-iv",
        tag,
        false,
      );
    });

    it("throws on invalid format (missing colon)", async () => {
      await expect(encryptionService.decrypt("no-colon-here")).rejects.toThrow(
        "Invalid cipher text format",
      );
    });

    it("throws on format with too many colons", async () => {
      await expect(encryptionService.decrypt("a:b:c")).rejects.toThrow(
        "Invalid cipher text format",
      );
    });

    it("throws descriptive error on AesGcmCrypto failure", async () => {
      mockGetItem.mockResolvedValueOnce("key");
      mockAesDecrypt.mockRejectedValueOnce(new Error("decrypt error"));

      const tag = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      await expect(
        encryptionService.decrypt(`iv:content${tag}`),
      ).rejects.toThrow("Decryption failed: decrypt error");
    });
  });
});
