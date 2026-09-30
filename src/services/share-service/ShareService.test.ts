import * as Clipboard from "expo-clipboard";
import { Directory } from "expo-file-system";
import { Share } from "react-native";

import { Session, Transcription } from "@/models";

import { shareService } from "./ShareService";

describe("ShareService", () => {
  const mockShare = jest.spyOn(Share, "share").mockResolvedValue({
    action: "sharedAction",
    activityType: undefined,
  });

  const makeTranscription = (id: string, text: string): Transcription => ({
    id,
    sessionId: "session-1",
    text,
    timestamp: new Date("2025-06-15T12:00:00.000Z"),
    audioPath: `/audio/${id}.wav`,
  });

  const makeSession = (name: string): Session => ({
    id: name,
    name,
    timestamp: new Date(0),
    lastModified: new Date(0),
    isIncognito: false,
  });

  describe("shareTranscriptions", () => {
    it("throws on empty array", async () => {
      await expect(shareService.shareTranscriptions([])).rejects.toThrow(
        "Cannot share empty transcription list",
      );
    });

    it("shares single transcription text", async () => {
      const t = makeTranscription("1", "Hello world");

      await shareService.shareTranscriptions([t]);

      expect(mockShare).toHaveBeenCalledWith({ message: "Hello world" });
    });

    it("joins multiple transcriptions with double newline", async () => {
      const t1 = makeTranscription("1", "First");
      const t2 = makeTranscription("2", "Second");

      await shareService.shareTranscriptions([t1, t2]);

      expect(mockShare).toHaveBeenCalledWith({
        message: "First\n\nSecond",
      });
    });

    it("handles Share.share rejection", async () => {
      mockShare.mockRejectedValueOnce(new Error("share failed"));

      const t = makeTranscription("1", "Hello");

      await expect(shareService.shareTranscriptions([t])).rejects.toThrow(
        "share failed",
      );
    });
  });

  describe("sessions", () => {
    const contents = [
      {
        session: makeSession("Standup"),
        transcriptions: [
          makeTranscription("1", "First"),
          makeTranscription("2", "Second"),
        ],
      },
      { session: makeSession("Empty"), transcriptions: [] },
      {
        session: makeSession("Retro"),
        transcriptions: [makeTranscription("3", "Third")],
      },
    ];

    it("copies every session's text, skipping empty ones", async () => {
      const spy = jest.spyOn(Clipboard, "setStringAsync");
      await shareService.copySessions(contents);
      expect(spy).toHaveBeenCalledWith("First\n\nSecond\n\nThird");
    });

    it("shares the same text via the system sheet", async () => {
      await shareService.shareSessions(contents);
      expect(mockShare).toHaveBeenCalledWith({
        message: "First\n\nSecond\n\nThird",
      });
    });

    it("returns false when the folder picker is dismissed", async () => {
      (Directory.pickDirectoryAsync as jest.Mock).mockRejectedValueOnce(
        new Error("cancelled"),
      );
      await expect(shareService.saveSessionsMarkdown(contents)).resolves.toBe(
        false,
      );
    });

    it("writes one uniquely named .md per session", async () => {
      const write = jest.fn();
      const createFile = jest.fn(() => ({ write }));
      (Directory.pickDirectoryAsync as jest.Mock).mockResolvedValueOnce({
        list: () => [{ name: "Standup.md" }],
        createFile,
      });
      const withSlash = {
        session: makeSession("a/b"),
        transcriptions: [makeTranscription("4", "x")],
      };
      const blank = { session: makeSession("  "), transcriptions: [] };

      await expect(
        shareService.saveSessionsMarkdown([contents[0], withSlash, blank]),
      ).resolves.toBe(true);

      expect(createFile.mock.calls).toEqual([
        ["Standup (2).md", "text/markdown"],
        ["a-b.md", "text/markdown"],
        ["Session.md", "text/markdown"],
      ]);
      expect(write).toHaveBeenCalledWith("# Standup\n\nFirst\n\nSecond\n");
    });
  });
});
