import { Share } from "react-native";

import { Transcription } from "@/models";

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
});
