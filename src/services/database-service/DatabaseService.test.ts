import { Session, Transcription } from "@/models";

import { databaseService } from "./DatabaseService";

// Stub `getDb()` with a chainable query builder that records calls and
// returns scriptable results. Each describe-block clears the mocks.
const queryResults: {
  rows: unknown[];
  first: unknown;
  runResult: { rowsAffected: number };
} = {
  rows: [],
  first: null,
  runResult: { rowsAffected: 0 },
};

const chain: {
  from: jest.Mock;
  where: jest.Mock;
  orderBy: jest.Mock;
  values: jest.Mock;
  set: jest.Mock;
  onConflictDoUpdate: jest.Mock;
  onConflictDoNothing: jest.Mock;
  all: jest.Mock;
  get: jest.Mock;
  run: jest.Mock;
} = {
  from: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  values: jest.fn(),
  set: jest.fn(),
  onConflictDoUpdate: jest.fn(),
  onConflictDoNothing: jest.fn(),
  all: jest.fn(),
  get: jest.fn(),
  run: jest.fn(),
};
// Self-referencing wiring so any sequence of chain calls returns the same
// thunk.
Object.values(chain).forEach((m) => m.mockReturnValue(chain));
chain.all.mockImplementation(async () => queryResults.rows);
chain.get.mockImplementation(async () => queryResults.first);
chain.run.mockImplementation(async () => queryResults.runResult);

const mockSelect = jest.fn(() => chain);
const mockInsert = jest.fn(() => chain);
const mockUpdate = jest.fn(() => chain);
const mockDelete = jest.fn(() => chain);

const mockRawDb = {
  execAsync: jest.fn(async () => undefined),
};

const mockTx = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
};

jest.mock("@/db", () => ({
  getDb: jest.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    // transaction(cb) invokes the callback with a tx handle exposing the
    // same chain so existing assertions on mockSelect/mockDelete continue
    // to fire whether or not the operation runs in a transaction.
    transaction: jest.fn(async (fn) => fn(mockTx)),
  })),
  getRawDatabase: jest.fn(() => mockRawDb),
}));

const sampleSession: Session = {
  id: "s1",
  name: "Session 1",
  timestamp: new Date("2024-01-01T00:00:00.000Z"),
  lastModified: new Date("2024-01-02T00:00:00.000Z"),
  isIncognito: false,
};

const sampleTranscription: Transcription = {
  id: "t1",
  sessionId: "s1",
  text: "Hi",
  timestamp: new Date("2024-01-01T00:00:00.000Z"),
  audioPath: "/audio/a.wav",
};

const sessionRowFor = (s: Session) => ({
  id: s.id,
  name: s.name,
  timestampMs: s.timestamp.getTime(),
  lastModifiedMs: s.lastModified.getTime(),
  isIncognito: s.isIncognito,
});

const transcriptionRowFor = (t: Transcription) => ({
  id: t.id,
  sessionId: t.sessionId,
  text: t.text,
  timestampMs: t.timestamp.getTime(),
  audioPath: t.audioPath,
});

beforeEach(() => {
  jest.clearAllMocks();
  Object.values(chain).forEach((m) => {
    m.mockReturnValue(chain);
  });
  chain.all.mockImplementation(async () => queryResults.rows);
  chain.get.mockImplementation(async () => queryResults.first);
  chain.run.mockImplementation(async () => queryResults.runResult);
  queryResults.rows = [];
  queryResults.first = null;
});

describe("DatabaseService", () => {
  describe("listSessions", () => {
    it("returns sessions ordered by lastModified descending", async () => {
      queryResults.rows = [sessionRowFor(sampleSession)];

      const result = await databaseService.listSessions();

      expect(result).toEqual([sampleSession]);
      expect(mockSelect).toHaveBeenCalled();
    });

    it("returns empty array when no rows", async () => {
      queryResults.rows = [];
      expect(await databaseService.listSessions()).toEqual([]);
    });
  });

  describe("upsertSession", () => {
    it("inserts with onConflictDoUpdate", async () => {
      await databaseService.upsertSession(sampleSession);

      expect(mockInsert).toHaveBeenCalled();
      expect(chain.values).toHaveBeenCalledWith(sessionRowFor(sampleSession));
      expect(chain.onConflictDoUpdate).toHaveBeenCalled();
      expect(chain.run).toHaveBeenCalled();
    });
  });

  describe("deleteSession", () => {
    it("returns cascade-deleted audio paths and runs delete", async () => {
      queryResults.rows = [
        { audioPath: "/audio/a.wav" },
        { audioPath: "/audio/b.wav" },
        { audioPath: "" }, // empty paths should be filtered out
      ];

      const result = await databaseService.deleteSession("s1");

      expect(result.deletedAudioPaths).toEqual([
        "/audio/a.wav",
        "/audio/b.wav",
      ]);
      expect(mockDelete).toHaveBeenCalled();
    });

    it("returns empty paths when session has no transcriptions", async () => {
      queryResults.rows = [];

      const result = await databaseService.deleteSession("s1");

      expect(result.deletedAudioPaths).toEqual([]);
    });
  });

  describe("active session id", () => {
    it("getActiveSessionId returns the stored value", async () => {
      queryResults.first = { key: "active_session_id", value: "s2" };

      const id = await databaseService.getActiveSessionId();
      expect(id).toBe("s2");
    });

    it("getActiveSessionId returns null when missing or empty", async () => {
      queryResults.first = null;
      expect(await databaseService.getActiveSessionId()).toBeNull();
      queryResults.first = { key: "active_session_id", value: "   " };
      expect(await databaseService.getActiveSessionId()).toBeNull();
    });

    it("setActiveSessionId(null) clears the row", async () => {
      await databaseService.setActiveSessionId(null);
      expect(mockDelete).toHaveBeenCalled();
    });

    it("setActiveSessionId(empty) clears the row", async () => {
      await databaseService.setActiveSessionId("   ");
      expect(mockDelete).toHaveBeenCalled();
    });

    it("setActiveSessionId('s2') upserts into meta", async () => {
      await databaseService.setActiveSessionId("s2");
      expect(mockInsert).toHaveBeenCalled();
      expect(chain.values).toHaveBeenCalledWith({
        key: "active_session_id",
        value: "s2",
      });
    });
  });

  describe("listTranscriptions", () => {
    it("returns all transcriptions ordered by timestampMs", async () => {
      queryResults.rows = [transcriptionRowFor(sampleTranscription)];

      const result = await databaseService.listTranscriptions();

      expect(result).toEqual([sampleTranscription]);
    });
  });

  describe("listTranscriptionsForSession", () => {
    it("filters by sessionId", async () => {
      queryResults.rows = [transcriptionRowFor(sampleTranscription)];

      const result = await databaseService.listTranscriptionsForSession("s1");

      expect(result).toEqual([sampleTranscription]);
      expect(chain.where).toHaveBeenCalled();
    });
  });

  describe("upsertTranscription", () => {
    it("inserts with onConflictDoUpdate", async () => {
      await databaseService.upsertTranscription(sampleTranscription);

      expect(chain.values).toHaveBeenCalledWith(
        transcriptionRowFor(sampleTranscription),
      );
      expect(chain.onConflictDoUpdate).toHaveBeenCalled();
    });
  });

  describe("deleteTranscription", () => {
    it("returns the audio path if present", async () => {
      queryResults.first = { audioPath: "/audio/a.wav" };

      const result = await databaseService.deleteTranscription("t1");

      expect(result.audioPath).toBe("/audio/a.wav");
      expect(mockDelete).toHaveBeenCalled();
    });

    it("returns null for empty audio path", async () => {
      queryResults.first = { audioPath: "" };

      const result = await databaseService.deleteTranscription("t1");

      expect(result.audioPath).toBeNull();
    });

    it("returns null when transcription doesn't exist", async () => {
      queryResults.first = null;

      const result = await databaseService.deleteTranscription("missing");

      expect(result.audioPath).toBeNull();
    });
  });

  describe("deleteTranscriptions (batch)", () => {
    it("returns audio paths for batch and skips empty ones", async () => {
      queryResults.rows = [
        { audioPath: "/audio/a.wav" },
        { audioPath: "" },
        { audioPath: "/audio/c.wav" },
      ];

      const result = await databaseService.deleteTranscriptions([
        "t1",
        "t2",
        "t3",
      ]);

      expect(result.audioPaths).toEqual(["/audio/a.wav", "/audio/c.wav"]);
      expect(mockDelete).toHaveBeenCalled();
    });

    it("returns empty audioPaths for empty id list without running DB", async () => {
      const result = await databaseService.deleteTranscriptions([]);

      expect(result.audioPaths).toEqual([]);
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  describe("clearAllTranscriptions", () => {
    it("returns audio paths and clears the table", async () => {
      queryResults.rows = [
        { audioPath: "/audio/a.wav" },
        { audioPath: "/audio/b.wav" },
        { audioPath: "" },
      ];

      const result = await databaseService.clearAllTranscriptions();

      expect(result.audioPaths).toEqual(["/audio/a.wav", "/audio/b.wav"]);
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe("vacuum", () => {
    it("issues a VACUUM statement against the raw db", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getRawDatabase } = require("@/db");
      await databaseService.vacuum();
      expect(getRawDatabase().execAsync).toHaveBeenCalledWith("VACUUM;");
    });
  });
});
