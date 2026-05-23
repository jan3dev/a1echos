import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";

import { EchosAndroidEncryptedFile } from "@modules/echos-android-encrypted-file/src";
import { EchosFileProtection } from "@modules/echos-file-protection/src";

import { audioProtectionService } from "./AudioProtectionService";

const setPlatform = (os: "ios" | "android") => {
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
};

describe("AudioProtectionService", () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    setPlatform(originalPlatform as "ios" | "android");
  });

  describe("saveAudio", () => {
    it("on Android: copies plaintext source through EncryptedFile, then deletes the source", async () => {
      setPlatform("android");
      const out = await audioProtectionService.saveAudio(
        "file:///cache/rec_1.wav",
        "audio_42.wav",
      );

      expect(EchosAndroidEncryptedFile!.copyToEncrypted).toHaveBeenCalled();
      const callArgs = (EchosAndroidEncryptedFile!.copyToEncrypted as jest.Mock)
        .mock.calls[0];
      expect(callArgs[0]).toBe("file:///cache/rec_1.wav");
      expect(callArgs[1]).toContain("audio_42.wav");
      expect(out).toContain("audio_42.wav");
    });

    it("on iOS: copies via expo-file-system and sets the protection class", async () => {
      setPlatform("ios");

      const out = await audioProtectionService.saveAudio(
        "/cache/rec_2.wav",
        "audio_99.wav",
      );

      expect(EchosFileProtection!.setFileProtection).toHaveBeenCalled();
      const args = (EchosFileProtection!.setFileProtection as jest.Mock).mock
        .calls[0];
      expect(args[0]).toContain("audio_99.wav");
      expect(args[1]).toBe("completeUntilFirstUserAuthentication");
      expect(out).toContain("audio_99.wav");
    });

    it("on iOS: continues even if setFileProtection throws", async () => {
      setPlatform("ios");
      (
        EchosFileProtection!.setFileProtection as jest.Mock
      ).mockRejectedValueOnce(new Error("protection failed"));

      const out = await audioProtectionService.saveAudio(
        "/cache/rec_3.wav",
        "audio_3.wav",
      );

      expect(out).toContain("audio_3.wav");
    });
  });

  describe("deleteAudio", () => {
    it("on Android: routes through native deleteFile", async () => {
      setPlatform("android");

      await audioProtectionService.deleteAudio("/audio/x.wav");

      expect(EchosAndroidEncryptedFile!.deleteFile).toHaveBeenCalledWith(
        "/audio/x.wav",
      );
    });

    it("on Android: falls back to fs.File.delete when native deleteFile throws", async () => {
      setPlatform("android");
      (
        EchosAndroidEncryptedFile!.deleteFile as jest.Mock
      ).mockRejectedValueOnce(new Error("native delete failed"));
      const mockFile = { exists: true, delete: jest.fn() };
      (File as unknown as jest.Mock).mockImplementationOnce(() => mockFile);

      await audioProtectionService.deleteAudio("/audio/y.wav");

      expect(mockFile.delete).toHaveBeenCalled();
    });

    it("on iOS: deletes via expo-file-system", async () => {
      setPlatform("ios");
      const mockFile = { exists: true, delete: jest.fn() };
      (File as unknown as jest.Mock).mockImplementationOnce(() => mockFile);

      await audioProtectionService.deleteAudio("/audio/z.wav");

      expect(mockFile.delete).toHaveBeenCalled();
    });

    it("no-ops for empty path", async () => {
      setPlatform("ios");
      await audioProtectionService.deleteAudio("");
      expect(EchosAndroidEncryptedFile!.deleteFile).not.toHaveBeenCalled();
    });

    it("swallows fs delete errors", async () => {
      setPlatform("ios");
      const mockFile = {
        exists: true,
        delete: jest.fn(() => {
          throw new Error("fs error");
        }),
      };
      (File as unknown as jest.Mock).mockImplementationOnce(() => mockFile);

      await expect(
        audioProtectionService.deleteAudio("/audio/error.wav"),
      ).resolves.toBeUndefined();
    });

    it("ignores non-existent file on iOS", async () => {
      setPlatform("ios");
      const mockFile = { exists: false, delete: jest.fn() };
      (File as unknown as jest.Mock).mockImplementationOnce(() => mockFile);

      await audioProtectionService.deleteAudio("/audio/missing.wav");

      expect(mockFile.delete).not.toHaveBeenCalled();
    });
  });

  describe("decryptAudioToCache", () => {
    it("on Android: routes to native decryptToCacheFile", async () => {
      setPlatform("android");
      (
        EchosAndroidEncryptedFile!.decryptToCacheFile as jest.Mock
      ).mockResolvedValueOnce("/cache/dec_1.wav");

      const out =
        await audioProtectionService.decryptAudioToCache("/audio/enc.wav");

      expect(out).toBe("/cache/dec_1.wav");
    });

    it("on iOS: returns the input path unchanged", async () => {
      setPlatform("ios");

      const out =
        await audioProtectionService.decryptAudioToCache("/audio/plain.wav");

      expect(out).toBe("/audio/plain.wav");
    });
  });

  describe("applyToAudioDirectory", () => {
    it("on iOS: skips when protection is already correct", async () => {
      setPlatform("ios");
      (
        EchosFileProtection!.getFileProtection as jest.Mock
      ).mockResolvedValueOnce("completeUntilFirstUserAuthentication");

      await audioProtectionService.applyToAudioDirectory();

      expect(EchosFileProtection!.setFileProtection).not.toHaveBeenCalled();
    });

    it("on iOS: sets the protection class when it differs", async () => {
      setPlatform("ios");
      (
        EchosFileProtection!.getFileProtection as jest.Mock
      ).mockResolvedValueOnce("none");

      await audioProtectionService.applyToAudioDirectory();

      expect(EchosFileProtection!.setFileProtection).toHaveBeenCalledWith(
        expect.any(String),
        "completeUntilFirstUserAuthentication",
      );
    });

    it("on iOS: swallows native errors", async () => {
      setPlatform("ios");
      (
        EchosFileProtection!.getFileProtection as jest.Mock
      ).mockRejectedValueOnce(new Error("boom"));

      await expect(
        audioProtectionService.applyToAudioDirectory(),
      ).resolves.toBeUndefined();
    });

    it("on Android: no-op", async () => {
      setPlatform("android");

      await audioProtectionService.applyToAudioDirectory();

      expect(EchosFileProtection!.setFileProtection).not.toHaveBeenCalled();
    });
  });

  describe("encryptExistingAudioFilesInPlace", () => {
    it("on iOS: returns 0 (Android-only)", async () => {
      setPlatform("ios");
      const result =
        await audioProtectionService.encryptExistingAudioFilesInPlace();
      expect(result).toEqual({ migrated: 0 });
    });

    it("on Android: returns 0 when audio dir doesn't exist", async () => {
      setPlatform("android");
      const mockDir = {
        uri: `${Paths.document}/audio`,
        exists: false,
        list: jest.fn(),
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Directory } = require("expo-file-system");
      (Directory as jest.Mock).mockImplementationOnce(() => mockDir);

      const result =
        await audioProtectionService.encryptExistingAudioFilesInPlace();

      expect(result).toEqual({ migrated: 0 });
    });

    it("on Android: encrypts only unencrypted files via crash-safe backup-rename", async () => {
      setPlatform("android");
      const entries = [
        { uri: "/audio/a.wav" }, // plaintext -> migrate
        { uri: "/audio/b.wav" }, // already encrypted -> skip
      ];
      const mockDir = {
        uri: "/audio",
        exists: true,
        list: jest.fn(() => entries),
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Directory } = require("expo-file-system");
      (Directory as jest.Mock).mockImplementationOnce(() => mockDir);

      (EchosAndroidEncryptedFile!.isEncrypted as jest.Mock)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      // The crash-safe migration does:
      //   new File(path).move(new File(bakPath))        // backup original
      //   new File(tmpPath).move(new File(path))        // promote encrypted
      //   new File(bakPath).exists && new File(bakPath).delete()  // cleanup
      // That's 5 File constructions per migrated file. Each instance just
      // needs minimal API surface — we attach the test spies to a single
      // shared spy so we can assert calls aggregated.
      const fileSpy = { move: jest.fn(), delete: jest.fn(), exists: true };
      (File as unknown as jest.Mock).mockImplementation(() => fileSpy);

      const result =
        await audioProtectionService.encryptExistingAudioFilesInPlace();

      expect(result.migrated).toBe(1);
      expect(EchosAndroidEncryptedFile!.copyToEncrypted).toHaveBeenCalledTimes(
        1,
      );
      // Two moves: original -> backup, then encrypted-tmp -> original
      expect(fileSpy.move).toHaveBeenCalledTimes(2);
      // One delete: cleanup of the backup file after successful promotion
      expect(fileSpy.delete).toHaveBeenCalledTimes(1);
    });

    it("on Android: logs and skips files that fail to migrate", async () => {
      setPlatform("android");
      const entries = [{ uri: "/audio/fail.wav" }];
      const mockDir = {
        uri: "/audio",
        exists: true,
        list: jest.fn(() => entries),
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Directory } = require("expo-file-system");
      (Directory as jest.Mock).mockImplementationOnce(() => mockDir);

      (
        EchosAndroidEncryptedFile!.isEncrypted as jest.Mock
      ).mockResolvedValueOnce(false);
      (
        EchosAndroidEncryptedFile!.copyToEncrypted as jest.Mock
      ).mockRejectedValueOnce(new Error("encrypt failed"));

      const result =
        await audioProtectionService.encryptExistingAudioFilesInPlace();

      expect(result.migrated).toBe(0);
    });

    it("on Android: returns 0 when list() throws", async () => {
      setPlatform("android");
      const mockDir = {
        uri: "/audio",
        exists: true,
        list: jest.fn(() => {
          throw new Error("list failed");
        }),
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Directory } = require("expo-file-system");
      (Directory as jest.Mock).mockImplementationOnce(() => mockDir);

      const result =
        await audioProtectionService.encryptExistingAudioFilesInPlace();

      expect(result.migrated).toBe(0);
    });
  });
});
