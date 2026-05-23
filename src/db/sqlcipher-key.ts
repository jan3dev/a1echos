import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

// Distinct from the legacy "aes_data_key" used by EncryptionService so the
// SQLCipher key generation is independent of any legacy key-rotation work.
const SQLCIPHER_KEY = "sqlcipher_db_key";
const KEY_FORMAT = /^[0-9a-f]{64}$/;

const toHex = (bytes: Uint8Array): string => {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    out += b < 0x10 ? `0${b.toString(16)}` : b.toString(16);
  }
  return out;
};

export class SqlcipherKeyCorruptedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SqlcipherKeyCorruptedError";
  }
}

export async function getOrCreateSqlcipherKey(): Promise<string> {
  let existing: string | null;
  try {
    existing = await SecureStore.getItemAsync(SQLCIPHER_KEY);
  } catch (error) {
    // SecureStore read failure is NOT a "no key yet" signal — the key may
    // exist but be unreadable (Keychain locked, hardware error). Generating
    // a new one would destroy the DB. Surface and let the caller decide.
    throw new SqlcipherKeyCorruptedError(
      `Failed to read SQLCipher key from SecureStore: ${error}`,
    );
  }

  if (existing !== null) {
    if (KEY_FORMAT.test(existing)) return existing;
    // Stored value exists but is malformed. This should never happen via
    // this module — refuse to overwrite a key we can't recognize, since
    // doing so would orphan an encrypted database.
    throw new SqlcipherKeyCorruptedError(
      "Stored SQLCipher key is malformed (expected 64-hex). Refusing to overwrite.",
    );
  }

  const bytes = await Crypto.getRandomBytesAsync(32);
  const hex = toHex(bytes);
  await SecureStore.setItemAsync(SQLCIPHER_KEY, hex, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
  return hex;
}

export const __SQLCIPHER_KEY_STORE_KEY__ = SQLCIPHER_KEY;
