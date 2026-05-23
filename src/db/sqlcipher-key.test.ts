import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

import {
  __SQLCIPHER_KEY_STORE_KEY__,
  SqlcipherKeyCorruptedError,
  getOrCreateSqlcipherKey,
} from "./sqlcipher-key";

describe("sqlcipher-key", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the existing 64-char hex key when one is present", async () => {
    const existing = "a".repeat(64);
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(existing);

    const key = await getOrCreateSqlcipherKey();

    expect(key).toBe(existing);
    expect(Crypto.getRandomBytesAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("generates and stores a 64-char hex key on first call", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);
    const bytes = new Uint8Array(32);
    bytes.fill(0xab);
    (Crypto.getRandomBytesAsync as jest.Mock).mockResolvedValueOnce(bytes);

    const key = await getOrCreateSqlcipherKey();

    expect(key).toBe("ab".repeat(32));
    expect(Crypto.getRandomBytesAsync).toHaveBeenCalledWith(32);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      __SQLCIPHER_KEY_STORE_KEY__,
      "ab".repeat(32),
      expect.objectContaining({
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      }),
    );
  });

  it("throws SqlcipherKeyCorruptedError when stored value is malformed (never silently overwrites)", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce("garbage");

    await expect(getOrCreateSqlcipherKey()).rejects.toBeInstanceOf(
      SqlcipherKeyCorruptedError,
    );
    expect(Crypto.getRandomBytesAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("throws SqlcipherKeyCorruptedError when SecureStore read fails", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(
      new Error("keychain locked"),
    );

    await expect(getOrCreateSqlcipherKey()).rejects.toBeInstanceOf(
      SqlcipherKeyCorruptedError,
    );
    expect(Crypto.getRandomBytesAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("uses the dedicated SQLCipher key slot, not the legacy aes_data_key", () => {
    expect(__SQLCIPHER_KEY_STORE_KEY__).toBe("sqlcipher_db_key");
    expect(__SQLCIPHER_KEY_STORE_KEY__).not.toBe("aes_data_key");
  });

  it("pads single-digit bytes to two hex chars", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);
    const bytes = new Uint8Array([0x00, 0x01, 0x0f, 0xff, 0xa0]);
    // Pad the rest with zeros to make 32 bytes total.
    const full = new Uint8Array(32);
    full.set(bytes);
    (Crypto.getRandomBytesAsync as jest.Mock).mockResolvedValueOnce(full);

    const key = await getOrCreateSqlcipherKey();

    // First five bytes encoded; rest are zero-bytes -> "00" each.
    expect(key.startsWith("00010fffa0")).toBe(true);
    expect(key).toHaveLength(64);
  });
});
