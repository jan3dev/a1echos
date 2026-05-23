import { drizzle } from "drizzle-orm/expo-sqlite";
import { Paths } from "expo-file-system";
import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

import { FeatureFlag, logWarn } from "@/utils";

import * as schema from "./schema";
import { getOrCreateSqlcipherKey } from "./sqlcipher-key";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

const DATABASE_NAME = "echos.db";

let _db: Db | null = null;
let _raw: SQLite.SQLiteDatabase | null = null;

export async function openAndPrepareDatabase(): Promise<Db> {
  if (_db) return _db;

  const hex = await getOrCreateSqlcipherKey();
  // Defensive: getOrCreateSqlcipherKey already validates, but the PRAGMA
  // below interpolates into SQL so any future regression here would be a
  // critical injection vector. Re-assert immediately before the interpolation.
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    throw new Error("SQLCipher key failed format check");
  }
  const raw = SQLite.openDatabaseSync(DATABASE_NAME);

  // SQLCipher PRAGMAs MUST run before any other statement on the connection.
  // Raw-key form (x'<hex>') skips PBKDF2 — the key is already 256 random bits.
  await raw.execAsync(`PRAGMA key = "x'${hex}'";`);
  await raw.execAsync("PRAGMA cipher_compatibility = 4;");
  await raw.execAsync("PRAGMA foreign_keys = ON;");
  await raw.execAsync("PRAGMA journal_mode = WAL;");
  // A wrong key fails on first read, not on the PRAGMA call — probe explicitly.
  await raw.execAsync("SELECT count(*) FROM sqlite_master;");

  if (Platform.OS === "ios") {
    // expo-sqlite stores DBs under {documentDirectory}/SQLite/<name>. iOS
    // file protection is applied via Info.plist NSFileProtectionDefault
    // (set by withFileProtection plugin). iCloud backup exclusion happens
    // here so a restored device doesn't appear to have data without the key.
    try {
      const { EchosFileProtection } = await import(
        "@modules/echos-file-protection/src"
      );
      // Normalize the trailing slash on Paths.document.uri so a future
      // upstream change in expo-file-system doesn't silently produce a
      // wrong path (and miss the iCloud-backup exclusion).
      const docDir = Paths.document.uri.endsWith("/")
        ? Paths.document.uri
        : `${Paths.document.uri}/`;
      const dbPath = `${docDir}SQLite/${DATABASE_NAME}`;
      await EchosFileProtection?.setBackupExcluded(dbPath, true);
    } catch (error) {
      logWarn(`Failed to exclude DB from iCloud backup: ${error}`, {
        flag: FeatureFlag.storage,
      });
    }
  }

  _raw = raw;
  _db = drizzle(raw, { schema });
  return _db;
}

export function getDb(): Db {
  if (!_db) {
    throw new Error(
      "Database not opened yet — call openAndPrepareDatabase() first.",
    );
  }
  return _db;
}

export function getRawDatabase(): SQLite.SQLiteDatabase {
  if (!_raw) {
    throw new Error(
      "Database not opened yet — call openAndPrepareDatabase() first.",
    );
  }
  return _raw;
}

// Test-only escape hatch. Resets the singleton so a different opener can be
// installed (e.g. better-sqlite3 in-memory in jest).
export function __resetDatabaseForTesting__(
  db?: Db,
  raw?: SQLite.SQLiteDatabase,
): void {
  _db = db ?? null;
  _raw = raw ?? null;
}
