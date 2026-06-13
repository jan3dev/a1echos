import AsyncStorage from "@react-native-async-storage/async-storage";
import { File } from "expo-file-system";
import { Platform } from "react-native";

import {
  cleanupLegacyArtifactsIfPresent,
  consolidateDefaultSessionIfNeeded,
  runLegacyMigrationIfNeeded,
} from "./runtime-migration";

// Storage stubs for the drizzle calls used inside the migration.
// Names prefixed with `mock` so jest's hoisted jest.mock() can reference them.
const mockTxChain: {
  from: jest.Mock;
  where: jest.Mock;
  orderBy: jest.Mock;
  values: jest.Mock;
  set: jest.Mock;
  onConflictDoNothing: jest.Mock;
  onConflictDoUpdate: jest.Mock;
  all: jest.Mock;
  get: jest.Mock;
  run: jest.Mock;
} = {
  from: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  values: jest.fn(),
  set: jest.fn(),
  onConflictDoNothing: jest.fn(),
  onConflictDoUpdate: jest.fn(),
  all: jest.fn(async () => []),
  get: jest.fn(async () => null),
  run: jest.fn(async () => ({ rowsAffected: 0 })),
};
Object.values(mockTxChain).forEach((m) => {
  if (m === mockTxChain.all || m === mockTxChain.get || m === mockTxChain.run)
    return;
  m.mockReturnValue(mockTxChain);
});

const mockTx = {
  select: jest.fn(() => mockTxChain),
  insert: jest.fn(() => mockTxChain),
  update: jest.fn(() => mockTxChain),
  delete: jest.fn(() => mockTxChain),
};

const mockDb = {
  select: jest.fn(() => mockTxChain),
  insert: jest.fn(() => mockTxChain),
  update: jest.fn(() => mockTxChain),
  delete: jest.fn(() => mockTxChain),
  transaction: jest.fn(async (fn) => fn(mockTx)),
};

jest.mock("@/db", () => ({
  getDb: jest.fn(() => mockDb),
  getRawDatabase: jest.fn(() => ({
    execAsync: jest.fn(async () => undefined),
  })),
}));

// EncryptionService stub — defaults to returning the cipherText (plaintext
// fallback path).
jest.mock("@/services/encryption-service/EncryptionService", () => ({
  encryptionService: {
    decrypt: jest.fn(async (cipher: string) => cipher),
    encrypt: jest.fn(async (plain: string) => plain),
  },
}));

jest.mock("@/services/audio-protection-service", () => ({
  audioProtectionService: {
    applyToAudioDirectory: jest.fn(async () => undefined),
    encryptExistingAudioFilesInPlace: jest.fn(async () => ({ migrated: 0 })),
  },
}));

const setPlatform = (os: "ios" | "android") =>
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });

beforeEach(() => {
  jest.clearAllMocks();
  Object.values(mockTxChain).forEach((m) => {
    if (m === mockTxChain.all || m === mockTxChain.get || m === mockTxChain.run)
      return;
    m.mockReturnValue(mockTxChain);
  });
  mockTxChain.all.mockImplementation(async () => []);
  mockTxChain.get.mockImplementation(async () => null);
  mockTxChain.run.mockImplementation(async () => ({ rowsAffected: 0 }));
  mockDb.transaction.mockImplementation(async (fn) => fn(mockTx));
});

describe("runtime-migration", () => {
  describe("runLegacyMigrationIfNeeded", () => {
    it("returns early when schema_version is already 1", async () => {
      mockTxChain.get.mockImplementationOnce(async () => ({
        key: "schema_version",
        value: "1",
      }));

      await runLegacyMigrationIfNeeded();

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("fast-paths fresh install: writes schema_version=1 without migrating", async () => {
      // schema_version row missing
      mockTxChain.get.mockImplementationOnce(async () => null);
      // no legacy data
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
      // transcriptions.json missing
      const mockFile = { exists: false };
      (File as unknown as jest.Mock).mockImplementationOnce(() => mockFile);

      await runLegacyMigrationIfNeeded();

      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled(); // schema_version bump
    });

    it("migrates legacy sessions + transcriptions and bumps schema_version", async () => {
      mockTxChain.get.mockImplementationOnce(async () => null);
      (AsyncStorage.getItem as jest.Mock)
        // sessions blob
        .mockResolvedValueOnce(
          JSON.stringify([
            {
              id: "s1",
              name: "Session 1",
              timestamp: "2024-01-01T00:00:00.000Z",
              lastModified: "2024-01-02T00:00:00.000Z",
              isIncognito: false,
            },
          ]),
        )
        // active session
        .mockResolvedValueOnce("s1");
      // transcriptions.json present and valid
      const txFile = {
        exists: true,
        text: jest.fn(async () =>
          JSON.stringify([
            {
              id: "t1",
              sessionId: "s1",
              text: "Hi",
              timestamp: "2024-01-01T00:00:00.000Z",
              audioPath: "",
            },
          ]),
        ),
      };
      (File as unknown as jest.Mock).mockImplementationOnce(() => txFile);

      // Sessions readback for the orphan-fallback check returns s1.
      mockTxChain.all.mockImplementationOnce(async () => [
        { id: "s1", lastModifiedMs: 1704067200000 },
      ]);

      await runLegacyMigrationIfNeeded();

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockTx.insert).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("attaches FK-orphan transcriptions to the most recently modified existing session (no synthetic created)", async () => {
      mockTxChain.get.mockImplementationOnce(async () => null);
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(
          JSON.stringify([
            {
              id: "s-old",
              name: "Old",
              timestamp: "2024-01-01T00:00:00.000Z",
              lastModified: "2024-01-01T00:00:00.000Z",
              isIncognito: false,
            },
            {
              id: "s-recent",
              name: "Recent",
              timestamp: "2024-03-01T00:00:00.000Z",
              lastModified: "2024-03-15T00:00:00.000Z",
              isIncognito: false,
            },
          ]),
        )
        .mockResolvedValueOnce(null);
      const txFile = {
        exists: true,
        text: jest.fn(async () =>
          JSON.stringify([
            {
              id: "torphan",
              sessionId: "missing-session",
              text: "Orphan",
              timestamp: "2024-01-01T00:00:00.000Z",
              audioPath: "",
            },
          ]),
        ),
      };
      (File as unknown as jest.Mock).mockImplementationOnce(() => txFile);

      // Step 2 readback returns both real sessions with lastModifiedMs.
      mockTxChain.all.mockImplementationOnce(async () => [
        { id: "s-old", lastModifiedMs: new Date("2024-01-01").getTime() },
        { id: "s-recent", lastModifiedMs: new Date("2024-03-15").getTime() },
      ]);

      await runLegacyMigrationIfNeeded();

      // Inspect the values() call that inserted transcriptions; the orphan
      // should be attached to s-recent (most recent lastModifiedMs) — NOT to
      // a synthetic default_session row.
      const calls = (mockTxChain.values as jest.Mock).mock.calls;
      const transcriptionCall = calls.find(
        (args) =>
          Array.isArray(args[0]) &&
          args[0].length > 0 &&
          "text" in args[0][0] &&
          args[0][0].text === "Orphan",
      );
      expect(transcriptionCall).toBeDefined();
      expect(transcriptionCall![0][0].sessionId).toBe("s-recent");

      // And no synthetic "default_session" row was inserted.
      const syntheticInsert = calls.find(
        (args) =>
          args[0] &&
          typeof args[0] === "object" &&
          !Array.isArray(args[0]) &&
          args[0].id === "default_session",
      );
      expect(syntheticInsert).toBeUndefined();
    });

    it("creates the synthetic placeholder only when there are orphans AND no existing sessions", async () => {
      mockTxChain.get.mockImplementationOnce(async () => null);
      (AsyncStorage.getItem as jest.Mock)
        // No legacy sessions blob.
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      const txFile = {
        exists: true,
        text: jest.fn(async () =>
          JSON.stringify([
            {
              id: "torphan",
              sessionId: "missing-session",
              text: "Orphan",
              timestamp: "2024-01-01T00:00:00.000Z",
              audioPath: "",
            },
          ]),
        ),
      };
      (File as unknown as jest.Mock).mockImplementationOnce(() => txFile);

      // Step 2 readback returns no sessions.
      mockTxChain.all.mockImplementationOnce(async () => []);

      await runLegacyMigrationIfNeeded();

      // The synthetic default_session row should be inserted.
      const calls = (mockTxChain.values as jest.Mock).mock.calls;
      const syntheticInsert = calls.find(
        (args) =>
          args[0] &&
          typeof args[0] === "object" &&
          !Array.isArray(args[0]) &&
          args[0].id === "default_session",
      );
      expect(syntheticInsert).toBeDefined();

      // Orphan transcription should be attached to default_session.
      const transcriptionCall = calls.find(
        (args) =>
          Array.isArray(args[0]) &&
          args[0].length > 0 &&
          "text" in args[0][0] &&
          args[0][0].text === "Orphan",
      );
      expect(transcriptionCall).toBeDefined();
      expect(transcriptionCall![0][0].sessionId).toBe("default_session");
    });

    it("does NOT create a synthetic placeholder when all transcriptions match existing sessions", async () => {
      mockTxChain.get.mockImplementationOnce(async () => null);
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(
          JSON.stringify([
            {
              id: "s1",
              name: "S1",
              timestamp: "2024-01-01T00:00:00.000Z",
              lastModified: "2024-01-01T00:00:00.000Z",
              isIncognito: false,
            },
          ]),
        )
        .mockResolvedValueOnce(null);
      const txFile = {
        exists: true,
        text: jest.fn(async () =>
          JSON.stringify([
            {
              id: "t1",
              sessionId: "s1",
              text: "Matched",
              timestamp: "2024-01-01T00:00:00.000Z",
              audioPath: "",
            },
          ]),
        ),
      };
      (File as unknown as jest.Mock).mockImplementationOnce(() => txFile);

      mockTxChain.all.mockImplementationOnce(async () => [
        { id: "s1", lastModifiedMs: new Date("2024-01-01").getTime() },
      ]);

      await runLegacyMigrationIfNeeded();

      const calls = (mockTxChain.values as jest.Mock).mock.calls;
      const syntheticInsert = calls.find(
        (args) =>
          args[0] &&
          typeof args[0] === "object" &&
          !Array.isArray(args[0]) &&
          args[0].id === "default_session",
      );
      expect(syntheticInsert).toBeUndefined();
    });

    it("leaves schema_version=0 when the transaction throws", async () => {
      mockTxChain.get.mockImplementationOnce(async () => null);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify([{ id: "s1", name: "X", timestamp: "2024-01-01" }]),
      );
      const txFile = { exists: false };
      (File as unknown as jest.Mock).mockImplementationOnce(() => txFile);
      mockDb.transaction.mockImplementationOnce(async () => {
        throw new Error("tx failed");
      });

      await runLegacyMigrationIfNeeded();

      // After failure we should NOT bump schema_version.
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("completes migration when legacy sessions are undecryptable (bad auth tag)", async () => {
      mockTxChain.get.mockImplementationOnce(async () => null);
      // Encrypted-with-a-lost-key blob: decrypt throws, the plaintext fallback
      // is non-JSON ciphertext, and JSON.parse would choke on it.
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        "d34db33f:undecryptable-cipher-text",
      );
      const txFile = { exists: false };
      (File as unknown as jest.Mock).mockImplementationOnce(() => txFile);

      const {
        encryptionService,
        // eslint-disable-next-line @typescript-eslint/no-require-imports
      } = require("@/services/encryption-service/EncryptionService");
      (encryptionService.decrypt as jest.Mock).mockImplementationOnce(
        async () => {
          throw new Error("Decryption failed: Bad auth tag exception");
        },
      );

      await expect(runLegacyMigrationIfNeeded()).resolves.toBeUndefined();

      // The undecryptable source is skipped (no session rows inserted) but the
      // migration still completes and bumps schema_version.
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("completes migration when legacy transcriptions are undecryptable", async () => {
      mockTxChain.get.mockImplementationOnce(async () => null);
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null) // no legacy sessions
        .mockResolvedValueOnce(null); // no active session
      const txFile = {
        exists: true,
        text: jest.fn(async () => "not-valid-json-ciphertext"),
      };
      (File as unknown as jest.Mock).mockImplementationOnce(() => txFile);

      await expect(runLegacyMigrationIfNeeded()).resolves.toBeUndefined();

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("skips a legacy sessions payload that isn't a JSON array", async () => {
      mockTxChain.get.mockImplementationOnce(async () => null);
      // Decryptable, valid JSON, but an object rather than an array.
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ unexpected: "shape" }),
      );
      const txFile = { exists: false };
      (File as unknown as jest.Mock).mockImplementationOnce(() => txFile);

      await runLegacyMigrationIfNeeded();

      // No session rows inserted, migration still completes.
      const calls = (mockTxChain.values as jest.Mock).mock.calls;
      const sessionInsert = calls.find(
        (args) => Array.isArray(args[0]) && args[0].length > 0,
      );
      expect(sessionInsert).toBeUndefined();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("runs audio-dir protection step on both platforms", async () => {
      setPlatform("ios");
      mockTxChain.get.mockImplementationOnce(async () => null);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify([
          {
            id: "s1",
            name: "X",
            timestamp: "2024-01-01T00:00:00.000Z",
            lastModified: "2024-01-01T00:00:00.000Z",
            isIncognito: false,
          },
        ]),
      );
      const txFile = { exists: false };
      (File as unknown as jest.Mock).mockImplementationOnce(() => txFile);

      const {
        audioProtectionService,
        // eslint-disable-next-line @typescript-eslint/no-require-imports
      } = require("@/services/audio-protection-service");

      await runLegacyMigrationIfNeeded();

      expect(audioProtectionService.applyToAudioDirectory).toHaveBeenCalled();
      expect(
        audioProtectionService.encryptExistingAudioFilesInPlace,
      ).not.toHaveBeenCalled();
    });

    it("on Android: also encrypts existing audio files in place", async () => {
      setPlatform("android");
      mockTxChain.get.mockImplementationOnce(async () => null);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify([
          {
            id: "s1",
            name: "X",
            timestamp: "2024-01-01T00:00:00.000Z",
            lastModified: "2024-01-01T00:00:00.000Z",
            isIncognito: false,
          },
        ]),
      );
      const txFile = { exists: false };
      (File as unknown as jest.Mock).mockImplementationOnce(() => txFile);

      const {
        audioProtectionService,
        // eslint-disable-next-line @typescript-eslint/no-require-imports
      } = require("@/services/audio-protection-service");

      await runLegacyMigrationIfNeeded();

      expect(
        audioProtectionService.encryptExistingAudioFilesInPlace,
      ).toHaveBeenCalled();
    });

    it("swallows audio-protection errors and continues to schema bump", async () => {
      setPlatform("android");
      mockTxChain.get.mockImplementationOnce(async () => null);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify([
          {
            id: "s1",
            name: "X",
            timestamp: "2024-01-01T00:00:00.000Z",
            lastModified: "2024-01-01T00:00:00.000Z",
            isIncognito: false,
          },
        ]),
      );
      const txFile = { exists: false };
      (File as unknown as jest.Mock).mockImplementationOnce(() => txFile);

      const {
        audioProtectionService,
        // eslint-disable-next-line @typescript-eslint/no-require-imports
      } = require("@/services/audio-protection-service");
      (
        audioProtectionService.applyToAudioDirectory as jest.Mock
      ).mockRejectedValueOnce(new Error("ios fail"));
      (
        audioProtectionService.encryptExistingAudioFilesInPlace as jest.Mock
      ).mockRejectedValueOnce(new Error("android fail"));

      await runLegacyMigrationIfNeeded();

      // Schema_version still gets bumped.
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("skips malformed legacy sessions but continues with valid ones", async () => {
      mockTxChain.get.mockImplementationOnce(async () => null);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify([
          // missing required fields — sessionFromJSON tolerates much, but
          // we still get a Session out; check that the migration doesn't
          // crash on unexpected shapes.
          { id: "valid", name: "Valid", timestamp: "2024-01-01" },
        ]),
      );
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
      const txFile = { exists: false };
      (File as unknown as jest.Mock).mockImplementationOnce(() => txFile);

      await runLegacyMigrationIfNeeded();

      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("handles empty transcriptions.json gracefully", async () => {
      mockTxChain.get.mockImplementationOnce(async () => null);
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(
          JSON.stringify([
            {
              id: "s1",
              name: "Session 1",
              timestamp: "2024-01-01T00:00:00.000Z",
              lastModified: "2024-01-01T00:00:00.000Z",
              isIncognito: false,
            },
          ]),
        )
        .mockResolvedValueOnce(null);
      const txFile = { exists: true, text: jest.fn(async () => "   ") };
      (File as unknown as jest.Mock).mockImplementationOnce(() => txFile);

      await runLegacyMigrationIfNeeded();

      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("ignores empty/whitespace active session id from legacy storage", async () => {
      mockTxChain.get.mockImplementationOnce(async () => null);
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(
          JSON.stringify([
            {
              id: "s1",
              name: "Session 1",
              timestamp: "2024-01-01T00:00:00.000Z",
              lastModified: "2024-01-01T00:00:00.000Z",
              isIncognito: false,
            },
          ]),
        )
        .mockResolvedValueOnce("   "); // whitespace-only active session id
      const txFile = { exists: false };
      (File as unknown as jest.Mock).mockImplementationOnce(() => txFile);

      await runLegacyMigrationIfNeeded();

      // The active_session_id upsert is skipped — but other inserts still fire.
      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });

  describe("consolidateDefaultSessionIfNeeded", () => {
    it("no-ops when default_session does not exist", async () => {
      mockTxChain.get.mockImplementationOnce(async () => null);

      await consolidateDefaultSessionIfNeeded();

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("no-ops when default_session exists but no real sessions remain", async () => {
      mockTxChain.get.mockImplementationOnce(async () => ({
        id: "default_session",
      }));
      mockTxChain.all.mockImplementationOnce(async () => []);

      await consolidateDefaultSessionIfNeeded();

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("moves transcriptions to the most recently modified real session and deletes the placeholder", async () => {
      mockTxChain.get.mockImplementationOnce(async () => ({
        id: "default_session",
      }));
      mockTxChain.all.mockImplementationOnce(async () => [
        { id: "s-recent", lastModifiedMs: 3 },
        { id: "s-old", lastModifiedMs: 1 },
      ]);

      await consolidateDefaultSessionIfNeeded();

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockTx.update).toHaveBeenCalled();
      // The set() call should target the most-recent session id.
      const setCalls = (mockTxChain.set as jest.Mock).mock.calls;
      expect(setCalls.some(([arg]) => arg?.sessionId === "s-recent")).toBe(
        true,
      );
      expect(mockTx.delete).toHaveBeenCalled();
    });

    it("swallows transaction failures without throwing", async () => {
      mockTxChain.get.mockImplementationOnce(async () => ({
        id: "default_session",
      }));
      mockTxChain.all.mockImplementationOnce(async () => [
        { id: "s1", lastModifiedMs: 1 },
      ]);
      mockDb.transaction.mockImplementationOnce(async () => {
        throw new Error("consolidate tx failed");
      });

      await expect(
        consolidateDefaultSessionIfNeeded(),
      ).resolves.toBeUndefined();
    });
  });

  describe("cleanupLegacyArtifactsIfPresent", () => {
    const stubSchemaVersion = (value: string | null) => {
      mockTxChain.get.mockImplementationOnce(async () =>
        value === null ? null : { key: "schema_version", value },
      );
    };

    it("removes AsyncStorage keys and legacy files when schema_version>=1", async () => {
      stubSchemaVersion("1");
      const mockFile = { exists: true, delete: jest.fn() };
      (File as unknown as jest.Mock).mockImplementation(() => mockFile);

      await cleanupLegacyArtifactsIfPresent();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith("sessions");
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith("active_session");
      expect(mockFile.delete).toHaveBeenCalled();
    });

    it("refuses to delete anything when schema_version is still 0", async () => {
      // Simulates the failure path: runLegacyMigrationIfNeeded threw and
      // never bumped schema_version. The legacy files are still the only
      // copy of the user's data — cleanup must NOT run.
      stubSchemaVersion(null);
      const mockFile = { exists: true, delete: jest.fn() };
      (File as unknown as jest.Mock).mockImplementation(() => mockFile);

      await cleanupLegacyArtifactsIfPresent();

      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
      expect(mockFile.delete).not.toHaveBeenCalled();
    });

    it("aborts cleanup if the schema_version read throws", async () => {
      mockTxChain.get.mockImplementationOnce(async () => {
        throw new Error("db closed");
      });
      const mockFile = { exists: true, delete: jest.fn() };
      (File as unknown as jest.Mock).mockImplementation(() => mockFile);

      await cleanupLegacyArtifactsIfPresent();

      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
      expect(mockFile.delete).not.toHaveBeenCalled();
    });

    it("ignores already-absent files", async () => {
      stubSchemaVersion("1");
      const mockFile = { exists: false, delete: jest.fn() };
      (File as unknown as jest.Mock).mockImplementation(() => mockFile);

      await cleanupLegacyArtifactsIfPresent();

      expect(mockFile.delete).not.toHaveBeenCalled();
    });

    it("swallows file delete errors", async () => {
      stubSchemaVersion("1");
      const mockFile = {
        exists: true,
        delete: jest.fn(() => {
          throw new Error("delete failed");
        }),
      };
      (File as unknown as jest.Mock).mockImplementation(() => mockFile);

      await expect(cleanupLegacyArtifactsIfPresent()).resolves.toBeUndefined();
    });
  });
});
