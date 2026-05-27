import AsyncStorage from "@react-native-async-storage/async-storage";
import { desc, eq, ne } from "drizzle-orm";
import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";

import {
  Session,
  SessionJSON,
  TranscriptionJSON,
  sessionFromJSON,
  transcriptionFromJSON,
} from "@/models";
import { audioProtectionService } from "@/services/audio-protection-service";
import { encryptionService } from "@/services/encryption-service/EncryptionService";
import { FeatureFlag, logError, logInfo, logWarn } from "@/utils";

import { meta, sessions, transcriptions } from "./schema";
import { sessionToRow, transcriptionToRow } from "./types";

import { getDb } from "./index";

const LEGACY_SESSIONS_KEY = "sessions";
const LEGACY_ACTIVE_SESSION_KEY = "active_session";
const LEGACY_TRANSCRIPTIONS_FILE = "transcriptions.json";
const LEGACY_PENDING_DELETES_FILE = "pending_deletes.json";
const SCHEMA_VERSION_KEY = "schema_version";
const TARGET_SCHEMA_VERSION = "1";
const DEFAULT_SESSION_ID = "default_session";
const DEFAULT_SESSION_NAME = "Imported";

const INSERT_CHUNK_SIZE = 500;

function chunked<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function tryDecrypt(cipherText: string): Promise<string> {
  try {
    return await encryptionService.decrypt(cipherText);
  } catch (error) {
    // Legacy plaintext fallback — pre-encryption versions stored raw JSON.
    // Surface as a warn so silent fallbacks for corrupted-but-encrypted
    // payloads are observable in logs instead of vanishing into garbage data.
    logWarn(
      `Legacy decrypt failed — treating as plaintext fallback: ${error}`,
      { flag: FeatureFlag.storage },
    );
    return cipherText;
  }
}

async function getSchemaVersion(): Promise<number> {
  const row = await getDb()
    .select()
    .from(meta)
    .where(eq(meta.key, SCHEMA_VERSION_KEY))
    .get();
  if (!row) return 0;
  const parsed = Number(row.value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function setSchemaVersion(version: string): Promise<void> {
  await getDb()
    .insert(meta)
    .values({ key: SCHEMA_VERSION_KEY, value: version })
    .onConflictDoUpdate({ target: meta.key, set: { value: version } })
    .run();
}

/**
 * One-shot migration of legacy AES-GCM-encrypted JSON storage into the
 * SQLCipher-encrypted SQLite database. Idempotent: safe to call on every
 * launch — does nothing once `schema_version >= 1`.
 */
export async function runLegacyMigrationIfNeeded(): Promise<void> {
  const version = await getSchemaVersion();
  if (version >= 1) return;

  // Fresh-install fast path: nothing to migrate, just mark schema_version=1.
  const hasLegacySessions = await AsyncStorage.getItem(LEGACY_SESSIONS_KEY);
  const txFile = new File(Paths.document, LEGACY_TRANSCRIPTIONS_FILE);
  if (!hasLegacySessions && !txFile.exists) {
    await setSchemaVersion(TARGET_SCHEMA_VERSION);
    return;
  }

  logInfo("Starting legacy data migration to SQLCipher", {
    flag: FeatureFlag.storage,
  });

  let migratedSessions = 0;
  let migratedTranscriptions = 0;
  let orphanTranscriptions = 0;

  try {
    const db = getDb();
    await db.transaction(async (tx) => {
      // ---- Step 1: sessions ----
      if (hasLegacySessions) {
        const plain = await tryDecrypt(hasLegacySessions);
        const list = JSON.parse(plain) as SessionJSON[];
        const rows = list
          .map((json) => {
            try {
              return sessionToRow(sessionFromJSON(json));
            } catch (error) {
              logWarn(`Skipping malformed legacy session: ${error}`, {
                flag: FeatureFlag.storage,
              });
              return null;
            }
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);

        for (const chunk of chunked(rows, INSERT_CHUNK_SIZE)) {
          await tx.insert(sessions).values(chunk).onConflictDoNothing().run();
        }
        migratedSessions = rows.length;
      }

      // ---- Step 2: read existing session IDs back ----
      // We use these both to detect FK orphans and to pick a fallback parent
      // for any orphan transcriptions (most-recently-modified existing
      // session). The synthetic placeholder session is only created in the
      // edge case where there are orphans AND no real sessions to attach to.
      const sessionRows = await tx
        .select({
          id: sessions.id,
          lastModifiedMs: sessions.lastModifiedMs,
        })
        .from(sessions)
        .all();
      const existingSessionIds = new Set(sessionRows.map((r) => r.id));

      // ---- Step 3: transcriptions ----
      if (txFile.exists) {
        const cipher = await txFile.text();
        if (cipher && cipher.trim() !== "") {
          const plain = await tryDecrypt(cipher);
          const list = JSON.parse(plain) as TranscriptionJSON[];
          const allRows = list
            .map((json) => {
              try {
                return transcriptionToRow(transcriptionFromJSON(json));
              } catch (error) {
                logWarn(`Skipping malformed legacy transcription: ${error}`, {
                  flag: FeatureFlag.storage,
                });
                return null;
              }
            })
            .filter((r): r is NonNullable<typeof r> => r !== null);

          const orphans = allRows.filter(
            (row) => !existingSessionIds.has(row.sessionId),
          );

          // Determine the fallback parent for orphan transcriptions. Prefer
          // attaching to an existing session so the user never sees a
          // synthetic "Imported" row. Only fall back to creating a placeholder
          // if literally no sessions exist.
          let fallbackSessionId: string | null = null;
          if (orphans.length > 0) {
            if (sessionRows.length > 0) {
              const mostRecent = [...sessionRows].sort(
                (a, b) => b.lastModifiedMs - a.lastModifiedMs,
              )[0];
              fallbackSessionId = mostRecent.id;
            } else {
              const now = Date.now();
              const placeholder: Session = {
                id: DEFAULT_SESSION_ID,
                name: DEFAULT_SESSION_NAME,
                timestamp: new Date(now),
                lastModified: new Date(now),
                isIncognito: false,
              };
              await tx
                .insert(sessions)
                .values(sessionToRow(placeholder))
                .onConflictDoNothing()
                .run();
              fallbackSessionId = DEFAULT_SESSION_ID;
            }
          }

          // Split non-orphans from orphans so we don't need an `as string`
          // cast — the orphan branch only runs when fallbackSessionId is set.
          const rows = allRows.map((row) => {
            if (existingSessionIds.has(row.sessionId)) return row;
            orphanTranscriptions += 1;
            if (fallbackSessionId === null) {
              // Unreachable: orphans.length > 0 implies fallbackSessionId set
              // above. Keep the original row; insert will fail FK if it does
              // hit, which is the right signal.
              return row;
            }
            return { ...row, sessionId: fallbackSessionId };
          });

          for (const chunk of chunked(rows, INSERT_CHUNK_SIZE)) {
            await tx
              .insert(transcriptions)
              .values(chunk)
              .onConflictDoNothing()
              .run();
          }
          migratedTranscriptions = rows.length;
        }
      }

      // ---- Step 4: active session ID ----
      const activeRaw = await AsyncStorage.getItem(LEGACY_ACTIVE_SESSION_KEY);
      if (activeRaw) {
        const decrypted = await tryDecrypt(activeRaw);
        if (decrypted && decrypted.trim() !== "") {
          await tx
            .insert(meta)
            .values({ key: "active_session_id", value: decrypted })
            .onConflictDoUpdate({
              target: meta.key,
              set: { value: decrypted },
            })
            .run();
        }
      }
    });
  } catch (error) {
    logError(error, {
      flag: FeatureFlag.storage,
      message: "Legacy migration transaction failed — schema_version stays 0",
    });
    // Leave legacy files in place; we'll retry on next launch.
    return;
  }

  // ---- Step 5: audio protection (outside DB transaction — touches disk) ----
  try {
    await audioProtectionService.applyToAudioDirectory();
  } catch (error) {
    logWarn(`Failed to apply iOS audio dir protection: ${error}`, {
      flag: FeatureFlag.storage,
    });
  }
  if (Platform.OS === "android") {
    try {
      const result =
        await audioProtectionService.encryptExistingAudioFilesInPlace();
      logInfo(`Encrypted ${result.migrated} legacy audio files in place`, {
        flag: FeatureFlag.storage,
      });
    } catch (error) {
      logWarn(`Failed to encrypt legacy audio files: ${error}`, {
        flag: FeatureFlag.storage,
      });
    }
  }

  // ---- Step 6: bump schema_version (DB transaction committed; legacy work done) ----
  try {
    await setSchemaVersion(TARGET_SCHEMA_VERSION);
  } catch (error) {
    logError(error, {
      flag: FeatureFlag.storage,
      message: "Failed to bump schema_version after migration",
    });
    return;
  }

  // Cleanup of legacy AsyncStorage keys and files happens at the boot level
  // (`_layout.tsx`) on every launch — that's the safety net if we crash
  // between the schema_version bump and a cleanup call here. No need to
  // duplicate the work in-line.

  logInfo(
    `Legacy migration complete — sessions=${migratedSessions} transcriptions=${migratedTranscriptions} orphans=${orphanTranscriptions}`,
    { flag: FeatureFlag.storage },
  );
}

/**
 * Idempotent cleanup of the synthetic "default_session" row that an earlier
 * iteration of the migration created unconditionally. If a real session
 * exists, fold any transcriptions parked under the placeholder into the most
 * recently modified real session and delete the placeholder so the user
 * never sees an "Imported" row in the session list. Cheap to run on every
 * launch (one indexed point lookup).
 */
export async function consolidateDefaultSessionIfNeeded(): Promise<void> {
  const db = getDb();

  const placeholder = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.id, DEFAULT_SESSION_ID))
    .get();
  if (!placeholder) return;

  const realSessions = await db
    .select({
      id: sessions.id,
      lastModifiedMs: sessions.lastModifiedMs,
    })
    .from(sessions)
    .where(ne(sessions.id, DEFAULT_SESSION_ID))
    .orderBy(desc(sessions.lastModifiedMs))
    .all();

  if (realSessions.length === 0) {
    // No real sessions exist — preserve the placeholder so transcriptions
    // still have a parent. This is the no-sessions-but-some-transcriptions
    // edge case.
    return;
  }

  const targetSessionId = realSessions[0].id;

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(transcriptions)
        .set({ sessionId: targetSessionId })
        .where(eq(transcriptions.sessionId, DEFAULT_SESSION_ID))
        .run();
      await tx
        .delete(sessions)
        .where(eq(sessions.id, DEFAULT_SESSION_ID))
        .run();
    });
    logInfo(`Folded default_session transcriptions into ${targetSessionId}`, {
      flag: FeatureFlag.storage,
    });
  } catch (error) {
    logWarn(`Failed to consolidate default_session: ${error}`, {
      flag: FeatureFlag.storage,
    });
  }
}

/**
 * Best-effort cleanup of legacy storage artifacts. Gated on schema_version>=1
 * so a failed migration never wipes the only copy of the user's data — the
 * legacy files are the source of truth until the import has actually
 * committed. Runs on every successful launch so a crash between the
 * schema_version bump and this step doesn't leave stale files forever.
 */
export async function cleanupLegacyArtifactsIfPresent(): Promise<void> {
  // Refuse to delete legacy data unless the migration actually succeeded.
  // `runLegacyMigrationIfNeeded` catches its own errors and returns silently,
  // so without this gate a transient migration failure would lose data.
  try {
    if ((await getSchemaVersion()) < 1) return;
  } catch (error) {
    logWarn(`Skipping legacy cleanup — schema_version read failed: ${error}`, {
      flag: FeatureFlag.storage,
    });
    return;
  }

  await Promise.allSettled([
    AsyncStorage.removeItem(LEGACY_SESSIONS_KEY),
    AsyncStorage.removeItem(LEGACY_ACTIVE_SESSION_KEY),
  ]);

  for (const name of [
    LEGACY_TRANSCRIPTIONS_FILE,
    LEGACY_PENDING_DELETES_FILE,
  ]) {
    try {
      const file = new File(Paths.document, name);
      if (file.exists) file.delete();
    } catch (error) {
      logWarn(`Failed to delete legacy file ${name}: ${error}`, {
        flag: FeatureFlag.storage,
      });
    }
  }
}
