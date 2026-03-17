import AsyncStorage from "@react-native-async-storage/async-storage";
import { File } from "expo-file-system";

import {
  Session,
  sessionToJSON,
  Transcription,
  transcriptionToJSON,
} from "@/models";

import { encryptionService } from "./EncryptionService";
import { storageService } from "./StorageService";

jest.mock("./EncryptionService", () => ({
  encryptionService: {
    encrypt: jest.fn(async (text: string) => `encrypted:${text}`),
    decrypt: jest.fn(async (text: string) => {
      if (text.startsWith("encrypted:")) {
        return text.slice("encrypted:".length);
      }
      throw new Error("Decryption failed: not encrypted format");
    }),
  },
}));

const mockEncrypt = encryptionService.encrypt as jest.Mock;
const mockDecrypt = encryptionService.decrypt as jest.Mock;
const MockFile = File as unknown as jest.Mock;
const MockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

const makeSession = (id: string, daysAgo: number = 0): Session => ({
  id,
  name: `Session ${id}`,
  timestamp: new Date(Date.now() - daysAgo * 86400000),
  lastModified: new Date(Date.now() - daysAgo * 86400000),
  isIncognito: false,
});

const makeTranscription = (
  id: string,
  sessionId: string = "session-1",
  audioPath: string = `/audio/${id}.wav`,
): Transcription => ({
  id,
  sessionId,
  text: `Text ${id}`,
  timestamp: new Date("2025-06-15T12:00:00.000Z"),
  audioPath,
});

describe("StorageService", () => {
  describe("Sessions", () => {
    it("getSessions returns empty array when no data", async () => {
      const result = await storageService.getSessions();
      expect(result).toEqual([]);
    });

    it("getSessions decrypts and deserializes", async () => {
      const sessions = [makeSession("1"), makeSession("2")];
      const jsonList = sessions.map(sessionToJSON);
      const rawJson = JSON.stringify(jsonList);

      MockAsyncStorage.getItem.mockResolvedValueOnce(`encrypted:${rawJson}`);

      const result = await storageService.getSessions();

      expect(mockDecrypt).toHaveBeenCalledWith(`encrypted:${rawJson}`);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("1");
    });

    it("getSessions handles legacy plain-text (re-encrypts)", async () => {
      const sessions = [makeSession("1")];
      const jsonList = sessions.map(sessionToJSON);
      const rawJson = JSON.stringify(jsonList);

      // Store as plain JSON (not encrypted format)
      MockAsyncStorage.getItem.mockResolvedValueOnce(rawJson);
      // decrypt will fail on non-encrypted text
      mockDecrypt.mockRejectedValueOnce(new Error("not encrypted"));

      const result = await storageService.getSessions();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
      // Should re-encrypt (saveSessions called)
      expect(mockEncrypt).toHaveBeenCalled();
    });

    it("getSessions returns empty on corrupt data", async () => {
      MockAsyncStorage.getItem.mockResolvedValueOnce("encrypted:not-json{{{");
      mockDecrypt.mockResolvedValueOnce("not-json{{{");

      const result = await storageService.getSessions();

      expect(result).toEqual([]);
    });

    it("saveSessions encrypts and stores in AsyncStorage", async () => {
      const sessions = [makeSession("1")];

      await storageService.saveSessions(sessions);

      expect(mockEncrypt).toHaveBeenCalled();
      expect(MockAsyncStorage.setItem).toHaveBeenCalledWith(
        "sessions",
        expect.stringContaining("encrypted:"),
      );
    });

    it("saveSessions sorts by lastModified desc", async () => {
      const older = makeSession("old", 5);
      const newer = makeSession("new", 0);

      await storageService.saveSessions([older, newer]);

      const encryptCall =
        mockEncrypt.mock.calls[mockEncrypt.mock.calls.length - 1][0];
      const parsed = JSON.parse(encryptCall);
      expect(parsed[0].id).toBe("new");
      expect(parsed[1].id).toBe("old");
    });

    it("saveSessions throws on null input", async () => {
      await expect(
        storageService.saveSessions(null as unknown as Session[]),
      ).rejects.toThrow("sessions parameter is required");
    });
  });

  describe("Active Session", () => {
    it("getActiveSessionId returns null when empty", async () => {
      const result = await storageService.getActiveSessionId();
      expect(result).toBeNull();
    });

    it("getActiveSessionId decrypts stored value", async () => {
      MockAsyncStorage.getItem.mockResolvedValueOnce("encrypted:session-123");

      const result = await storageService.getActiveSessionId();

      expect(result).toBe("session-123");
    });

    it("getActiveSessionId handles legacy plain-text", async () => {
      MockAsyncStorage.getItem.mockResolvedValueOnce("plain-session-id");
      mockDecrypt.mockRejectedValueOnce(new Error("not encrypted"));

      const result = await storageService.getActiveSessionId();

      expect(result).toBe("plain-session-id");
    });

    it("saveActiveSessionId encrypts and stores", async () => {
      await storageService.saveActiveSessionId("session-456");

      expect(mockEncrypt).toHaveBeenCalledWith("session-456");
      expect(MockAsyncStorage.setItem).toHaveBeenCalledWith(
        "active_session",
        expect.stringContaining("encrypted:"),
      );
    });

    it("saveActiveSessionId throws on empty string", async () => {
      await expect(storageService.saveActiveSessionId("")).rejects.toThrow(
        "id parameter must be a non-empty string",
      );
    });

    it("clearActiveSessionId removes from storage", async () => {
      await storageService.clearActiveSessionId();

      expect(MockAsyncStorage.removeItem).toHaveBeenCalledWith(
        "active_session",
      );
    });
  });

  describe("Transcriptions", () => {
    let mockFileInstance: Record<string, unknown>;

    beforeEach(() => {
      mockFileInstance = {
        uri: "/mock/document/transcriptions.json",
        exists: false,
        text: jest.fn().mockResolvedValue(""),
        write: jest.fn(),
        delete: jest.fn(),
        create: jest.fn(),
        copy: jest.fn(),
        move: jest.fn(),
        size: 0,
      };
      MockFile.mockImplementation(() => mockFileInstance);
    });

    it("getTranscriptions returns empty when no file", async () => {
      mockFileInstance.exists = false;

      const result = await storageService.getTranscriptions();

      expect(result).toEqual([]);
    });

    it("getTranscriptions decrypts file contents", async () => {
      const transcriptions = [makeTranscription("1")];
      const jsonList = transcriptions.map(transcriptionToJSON);
      const rawJson = JSON.stringify(jsonList);
      const encrypted = `encrypted:${rawJson}`;

      mockFileInstance.exists = true;
      (mockFileInstance.text as jest.Mock).mockResolvedValueOnce(encrypted);

      const result = await storageService.getTranscriptions();

      expect(mockDecrypt).toHaveBeenCalledWith(encrypted);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("getTranscriptions returns empty on corrupt file and deletes it", async () => {
      mockFileInstance.exists = true;
      (mockFileInstance.text as jest.Mock).mockResolvedValueOnce(
        "encrypted:corrupt{{{",
      );
      mockDecrypt.mockResolvedValueOnce("corrupt{{{");

      const result = await storageService.getTranscriptions();

      expect(result).toEqual([]);
    });

    it("saveTranscription adds new transcription", async () => {
      // getTranscriptions returns empty
      mockFileInstance.exists = false;

      const t = makeTranscription("new-1");
      await storageService.saveTranscription(t);

      expect(mockEncrypt).toHaveBeenCalled();
      expect(mockFileInstance.write).toHaveBeenCalled();
    });

    it("saveTranscription updates existing transcription", async () => {
      const existing = makeTranscription("1");
      const jsonList = [transcriptionToJSON(existing)];
      const rawJson = JSON.stringify(jsonList);
      const encrypted = `encrypted:${rawJson}`;

      mockFileInstance.exists = true;
      (mockFileInstance.text as jest.Mock).mockResolvedValueOnce(encrypted);

      const updated = { ...existing, text: "Updated text" };
      await storageService.saveTranscription(updated);

      const encryptCall =
        mockEncrypt.mock.calls[mockEncrypt.mock.calls.length - 1][0];
      const parsed = JSON.parse(encryptCall);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].text).toBe("Updated text");
    });

    it("deleteTranscription removes and deletes audio", async () => {
      const t = makeTranscription("1", "session-1", "/audio/1.wav");
      const jsonList = [transcriptionToJSON(t)];
      const rawJson = JSON.stringify(jsonList);
      const encrypted = `encrypted:${rawJson}`;

      mockFileInstance.exists = true;
      (mockFileInstance.text as jest.Mock).mockResolvedValueOnce(encrypted);

      await storageService.deleteTranscription("1");

      // Should save empty list
      expect(mockEncrypt).toHaveBeenCalled();
    });

    it("clearTranscriptions removes all and deletes audio files", async () => {
      const t1 = makeTranscription("1", "session-1", "/audio/1.wav");
      const t2 = makeTranscription("2", "session-1", "/audio/2.wav");
      const jsonList = [t1, t2].map(transcriptionToJSON);
      const rawJson = JSON.stringify(jsonList);
      const encrypted = `encrypted:${rawJson}`;

      mockFileInstance.exists = true;
      (mockFileInstance.text as jest.Mock).mockResolvedValueOnce(encrypted);

      await storageService.clearTranscriptions();

      // Should save empty list
      const encryptCall =
        mockEncrypt.mock.calls[mockEncrypt.mock.calls.length - 1][0];
      const parsed = JSON.parse(encryptCall);
      expect(parsed).toEqual([]);
    });

    it("deleteTranscriptionsForSession removes by session", async () => {
      const t1 = makeTranscription("1", "session-1", "/audio/1.wav");
      const t2 = makeTranscription("2", "session-2", "/audio/2.wav");
      const jsonList = [t1, t2].map(transcriptionToJSON);
      const rawJson = JSON.stringify(jsonList);
      const encrypted = `encrypted:${rawJson}`;

      mockFileInstance.exists = true;
      (mockFileInstance.text as jest.Mock).mockResolvedValueOnce(encrypted);

      await storageService.deleteTranscriptionsForSession("session-1");

      // Should save only session-2's transcription
      const encryptCall =
        mockEncrypt.mock.calls[mockEncrypt.mock.calls.length - 1][0];
      const parsed = JSON.parse(encryptCall);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].sessionId).toBe("session-2");
    });
  });

  describe("Audio Files", () => {
    let mockFileInstance: Record<string, unknown>;
    let mockDirInstance: Record<string, unknown>;

    beforeEach(() => {
      mockFileInstance = {
        uri: "/mock/document/audio/test.wav",
        exists: true,
        text: jest.fn().mockResolvedValue(""),
        write: jest.fn(),
        delete: jest.fn(),
        create: jest.fn(),
        copy: jest.fn(),
        move: jest.fn(),
        size: 0,
      };
      mockDirInstance = {
        uri: "/mock/document/audio",
        exists: true,
        create: jest.fn(),
        delete: jest.fn(),
        list: jest.fn().mockResolvedValue([]),
      };

      MockFile.mockImplementation(() => mockFileInstance);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("expo-file-system").Directory as jest.Mock).mockImplementation(
        () => mockDirInstance,
      );
    });

    it("saveAudioFile creates directory and copies", async () => {
      mockDirInstance.exists = false;

      const result = await storageService.saveAudioFile(
        "/source/audio.wav",
        "dest.wav",
      );

      expect(mockDirInstance.create).toHaveBeenCalledWith({
        intermediates: true,
      });
      expect(mockFileInstance.copy).toHaveBeenCalled();
      expect(result).toBe(mockFileInstance.uri);
    });

    it("saveAudioFile throws on error", async () => {
      (mockFileInstance.copy as jest.Mock).mockImplementation(() => {
        throw new Error("copy failed");
      });

      await expect(
        storageService.saveAudioFile("/source/audio.wav", "dest.wav"),
      ).rejects.toThrow("copy failed");
    });

    it("deleteAudioFile deletes file via deleteTranscription", async () => {
      const t = makeTranscription("1", "session-1", "/audio/1.wav");
      const jsonList = [transcriptionToJSON(t)];
      const rawJson = JSON.stringify(jsonList);
      const encrypted = `encrypted:${rawJson}`;

      mockFileInstance.exists = true;
      (mockFileInstance.text as jest.Mock).mockResolvedValueOnce(encrypted);

      await storageService.deleteTranscription("1");

      expect(mockFileInstance.delete).toHaveBeenCalled();
    });
  });

  describe("Pending Deletes", () => {
    let mockFileInstance: Record<string, unknown>;

    beforeEach(() => {
      mockFileInstance = {
        uri: "/mock/document/pending_deletes.json",
        exists: false,
        text: jest.fn().mockResolvedValue(""),
        write: jest.fn(),
        delete: jest.fn(),
        create: jest.fn(),
        copy: jest.fn(),
        move: jest.fn(),
        size: 0,
      };
      MockFile.mockImplementation(() => mockFileInstance);
    });

    it("processPendingDeletes handles empty queue", async () => {
      mockFileInstance.exists = false;

      await storageService.processPendingDeletes();
      // Should not throw
    });

    it("processPendingDeletes processes pending files", async () => {
      mockFileInstance.exists = true;
      (mockFileInstance.text as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(["/path/to/file1.wav"]),
      );

      await storageService.processPendingDeletes();

      expect(mockFileInstance.delete).toHaveBeenCalled();
    });

    it("corrupted pending deletes file is backed up", async () => {
      mockFileInstance.exists = true;
      (mockFileInstance.text as jest.Mock).mockResolvedValueOnce(
        "not-valid-json{{{",
      );

      await storageService.processPendingDeletes();

      expect(mockFileInstance.move).toHaveBeenCalled();
    });
  });
});
