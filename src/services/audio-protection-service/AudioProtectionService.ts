import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

import { EchosAndroidEncryptedFile } from "@modules/echos-android-encrypted-file/src";
import { EchosFileProtection } from "@modules/echos-file-protection/src";
import { FeatureFlag, logError, logWarn } from "@/utils";

const AUDIO_DIR_NAME = "audio";
const IOS_PROTECTION_CLASS = "completeUntilFirstUserAuthentication";

const getAudioDirectory = (): Directory =>
  new Directory(Paths.document, AUDIO_DIR_NAME);

const ensureAudioDirExists = (): Directory => {
  const dir = getAudioDirectory();
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
};

const createAudioProtectionService = () => {
  /**
   * Persists a captured WAV from cache into the protected audio directory.
   * Returns the final URI/path of the saved file (encrypted on Android, plain
   * but file-system-protected on iOS).
   */
  const saveAudio = async (
    sourceUri: string,
    fileName: string,
  ): Promise<string> => {
    const dir = ensureAudioDirExists();
    const targetFile = new File(dir, fileName);

    if (Platform.OS === "android" && EchosAndroidEncryptedFile) {
      // EncryptedFile refuses to write to an existing file; native code handles that.
      await EchosAndroidEncryptedFile.copyToEncrypted(
        sourceUri,
        targetFile.uri,
      );
      // The plaintext source in cache is no longer needed.
      try {
        const src = new File(sourceUri);
        if (src.exists) src.delete();
      } catch (error) {
        logWarn(
          `Failed to delete plaintext cache WAV after encryption: ${error}`,
          {
            flag: FeatureFlag.storage,
          },
        );
      }
      return targetFile.uri;
    }

    // iOS path: plain file copy, then ensure the protection class is set.
    const src = new File(sourceUri);
    src.copy(targetFile);

    if (Platform.OS === "ios" && EchosFileProtection) {
      try {
        await EchosFileProtection.setFileProtection(
          targetFile.uri,
          IOS_PROTECTION_CLASS,
        );
      } catch (error) {
        logWarn(
          `Failed to set iOS file protection on ${targetFile.uri}: ${error}`,
          {
            flag: FeatureFlag.storage,
          },
        );
      }
    }

    return targetFile.uri;
  };

  const deleteAudio = async (path: string): Promise<void> => {
    if (!path || path.trim() === "") return;
    if (Platform.OS === "android" && EchosAndroidEncryptedFile) {
      try {
        await EchosAndroidEncryptedFile.deleteFile(path);
        return;
      } catch (error) {
        logWarn(
          `Native delete failed for ${path}, falling back to fs.File: ${error}`,
          {
            flag: FeatureFlag.storage,
          },
        );
      }
    }
    try {
      const file = new File(path);
      if (file.exists) file.delete();
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.storage,
        message: `Error deleting audio file ${path}`,
      });
    }
  };

  /**
   * On Android, decrypts an encrypted audio file to a temporary plaintext path
   * in the cache directory; the caller is responsible for cleanup.
   * On iOS, the file is already readable — returns the input path unchanged.
   */
  const decryptAudioToCache = async (path: string): Promise<string> => {
    if (Platform.OS === "android" && EchosAndroidEncryptedFile) {
      return EchosAndroidEncryptedFile.decryptToCacheFile(path);
    }
    return path;
  };

  /**
   * iOS: set the protection class on the audio directory. New files created
   * inside inherit the class. Safe to call repeatedly.
   * No-op on Android (handled per-file by EncryptedFile).
   * Note: directory-level protection only affects newly created children;
   * pre-existing files are not retroactively reprotected.
   */
  const applyToAudioDirectory = async (): Promise<void> => {
    if (Platform.OS !== "ios" || !EchosFileProtection) return;
    const dir = ensureAudioDirExists();
    try {
      const current = await EchosFileProtection.getFileProtection(dir.uri);
      if (current === IOS_PROTECTION_CLASS) return;
      await EchosFileProtection.setFileProtection(
        dir.uri,
        IOS_PROTECTION_CLASS,
      );
    } catch (error) {
      logWarn(`Failed to apply protection to audio dir: ${error}`, {
        flag: FeatureFlag.storage,
      });
    }
  };

  /**
   * Android only: encrypts any legacy plaintext WAVs in place. Used by the
   * one-shot migration runner. Idempotent — re-running on already-encrypted
   * files is a no-op.
   *
   * Crash-safe sequence per file:
   *   1. Encrypt original  → <path>.tmp_enc
   *   2. Rename original   → <path>.tmp_bak   (atomic single-FS rename)
   *   3. Rename tmp_enc    → <path>           (atomic single-FS rename)
   *   4. Delete tmp_bak
   * If we crash between 2 and 3, the next launch's recovery pass renames
   * tmp_bak back into place before retrying. Either way the user's audio
   * is never absent from disk.
   */
  const encryptExistingAudioFilesInPlace = async (): Promise<{
    migrated: number;
  }> => {
    if (Platform.OS !== "android" || !EchosAndroidEncryptedFile) {
      return { migrated: 0 };
    }
    const dir = getAudioDirectory();
    if (!dir.exists) return { migrated: 0 };

    let entries: (File | Directory)[];
    try {
      entries = dir.list();
    } catch (error) {
      logWarn(`Failed to list audio directory: ${error}`, {
        flag: FeatureFlag.storage,
      });
      return { migrated: 0 };
    }

    // Recovery pass: undo any half-finished swap from a previous crash.
    // <path>.tmp_bak with a missing <path> means we crashed mid-rename —
    // restore the backup. Stray <path>.tmp_enc (with original still present)
    // means we crashed before step 2 — delete the orphan.
    for (const entry of entries) {
      const uri = entry.uri;
      if (uri.endsWith(".tmp_bak")) {
        const originalPath = uri.slice(0, -".tmp_bak".length);
        const original = new File(originalPath);
        if (!original.exists) {
          try {
            new File(uri).move(new File(originalPath));
          } catch (error) {
            logWarn(`Recovery rename failed for ${uri}: ${error}`, {
              flag: FeatureFlag.storage,
            });
          }
        } else {
          try {
            new File(uri).delete();
          } catch (error) {
            logWarn(`Cleanup of orphan ${uri} failed: ${error}`, {
              flag: FeatureFlag.storage,
            });
          }
        }
      } else if (uri.endsWith(".tmp_enc")) {
        try {
          new File(uri).delete();
        } catch (error) {
          logWarn(`Cleanup of orphan ${uri} failed: ${error}`, {
            flag: FeatureFlag.storage,
          });
        }
      }
    }

    // Re-list after recovery so we don't process the cleanup leftovers.
    let postRecovery: (File | Directory)[];
    try {
      postRecovery = dir.list();
    } catch (error) {
      logWarn(`Failed to re-list audio directory after recovery: ${error}`, {
        flag: FeatureFlag.storage,
      });
      return { migrated: 0 };
    }

    let migrated = 0;
    for (const entry of postRecovery) {
      const path = entry.uri;
      if (path.endsWith(".tmp_bak") || path.endsWith(".tmp_enc")) continue;

      try {
        const alreadyEncrypted =
          await EchosAndroidEncryptedFile.isEncrypted(path);
        if (alreadyEncrypted) continue;

        const tmpPath = `${path}.tmp_enc`;
        const bakPath = `${path}.tmp_bak`;
        await EchosAndroidEncryptedFile.copyToEncrypted(path, tmpPath);
        new File(path).move(new File(bakPath));
        new File(tmpPath).move(new File(path));
        const bak = new File(bakPath);
        if (bak.exists) bak.delete();
        migrated += 1;
      } catch (error) {
        logWarn(`Failed to encrypt legacy audio file ${path}: ${error}`, {
          flag: FeatureFlag.storage,
        });
      }
    }
    return { migrated };
  };

  return {
    saveAudio,
    deleteAudio,
    decryptAudioToCache,
    applyToAudioDirectory,
    encryptExistingAudioFilesInPlace,
  };
};

export const audioProtectionService = createAudioProtectionService();
export default audioProtectionService;
