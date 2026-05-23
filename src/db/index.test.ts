import * as SQLite from "expo-sqlite";

import {
  __resetDatabaseForTesting__,
  getDb,
  getRawDatabase,
  openAndPrepareDatabase,
} from "./index";

jest.mock("./sqlcipher-key", () => ({
  getOrCreateSqlcipherKey: jest.fn(async () => "a".repeat(64)),
}));

describe("db/index", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetDatabaseForTesting__();
  });

  afterEach(() => {
    __resetDatabaseForTesting__();
  });

  describe("getDb / getRawDatabase", () => {
    it("throws when DB is not yet open", () => {
      expect(() => getDb()).toThrow(/not opened yet/);
      expect(() => getRawDatabase()).toThrow(/not opened yet/);
    });
  });

  describe("openAndPrepareDatabase", () => {
    it("opens the DB, sets the SQLCipher PRAGMAs in order, and probes", async () => {
      const execAsync = jest.fn(async () => undefined);
      (SQLite.openDatabaseSync as jest.Mock).mockReturnValueOnce({
        execAsync,
      });

      const db = await openAndPrepareDatabase();
      expect(db).toBeDefined();

      const sqlCalls = execAsync.mock.calls.map(
        (c: unknown[]) => c[0] as string,
      );
      expect(sqlCalls[0]).toMatch(/^PRAGMA key = "x'[0-9a-f]{64}'";$/);
      expect(sqlCalls[1]).toBe("PRAGMA cipher_compatibility = 4;");
      expect(sqlCalls[2]).toBe("PRAGMA foreign_keys = ON;");
      expect(sqlCalls[3]).toBe("PRAGMA journal_mode = WAL;");
      expect(sqlCalls[4]).toBe("SELECT count(*) FROM sqlite_master;");
    });

    it("returns the cached instance on subsequent calls", async () => {
      (SQLite.openDatabaseSync as jest.Mock).mockReturnValueOnce({
        execAsync: jest.fn(async () => undefined),
      });
      const first = await openAndPrepareDatabase();
      const second = await openAndPrepareDatabase();
      expect(first).toBe(second);
      // Should only open the underlying DB once.
      expect(SQLite.openDatabaseSync).toHaveBeenCalledTimes(1);
    });

    it("getDb / getRawDatabase return the prepared instances", async () => {
      const execAsync = jest.fn(async () => undefined);
      const rawDb = { execAsync };
      (SQLite.openDatabaseSync as jest.Mock).mockReturnValueOnce(rawDb);

      await openAndPrepareDatabase();

      expect(getRawDatabase()).toBe(rawDb);
      expect(getDb()).toBeDefined();
    });
  });
});
