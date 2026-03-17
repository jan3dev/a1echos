import {
  createTranscription,
  transcriptionToJSON,
  transcriptionFromJSON,
  Transcription,
  TranscriptionJSON,
} from "./Transcription";

describe("Transcription", () => {
  const now = new Date("2025-06-15T12:00:00.000Z");

  describe("createTranscription", () => {
    it("returns correct object with all params", () => {
      const t = createTranscription({
        id: "1",
        sessionId: "session-1",
        text: "Hello world",
        timestamp: now,
        audioPath: "/audio/1.wav",
      });

      expect(t).toEqual({
        id: "1",
        sessionId: "session-1",
        text: "Hello world",
        timestamp: now,
        audioPath: "/audio/1.wav",
      });
    });

    it('defaults sessionId to "default_session" when omitted', () => {
      const t = createTranscription({
        id: "1",
        text: "Hello",
        timestamp: now,
        audioPath: "/audio/1.wav",
      });
      expect(t.sessionId).toBe("default_session");
    });
  });

  describe("transcriptionToJSON", () => {
    const transcription: Transcription = {
      id: "1",
      sessionId: "session-1",
      text: "Hello world",
      timestamp: now,
      audioPath: "/audio/1.wav",
    };

    it("converts Date to ISO string", () => {
      const json = transcriptionToJSON(transcription);
      expect(json.timestamp).toBe("2025-06-15T12:00:00.000Z");
    });

    it("includes all fields", () => {
      const json = transcriptionToJSON(transcription);
      expect(json).toEqual({
        id: "1",
        sessionId: "session-1",
        text: "Hello world",
        timestamp: "2025-06-15T12:00:00.000Z",
        audioPath: "/audio/1.wav",
      });
    });
  });

  describe("transcriptionFromJSON", () => {
    it("parses ISO string to Date", () => {
      const json: TranscriptionJSON = {
        id: "1",
        sessionId: "session-1",
        text: "Hello",
        timestamp: "2025-06-15T12:00:00.000Z",
        audioPath: "/audio/1.wav",
      };
      const t = transcriptionFromJSON(json);
      expect(t.timestamp).toBeInstanceOf(Date);
      expect(t.timestamp.getTime()).toBe(now.getTime());
    });

    it('defaults sessionId to "default_session" when missing', () => {
      const json = {
        id: "1",
        text: "Hello",
        timestamp: "2025-06-15T12:00:00.000Z",
        audioPath: "/audio/1.wav",
      } as TranscriptionJSON;
      const t = transcriptionFromJSON(json);
      expect(t.sessionId).toBe("default_session");
    });

    it("throws on invalid timestamp", () => {
      const json: TranscriptionJSON = {
        id: "1",
        sessionId: "session-1",
        text: "Hello",
        timestamp: "not-a-date",
        audioPath: "/audio/1.wav",
      };
      expect(() => transcriptionFromJSON(json)).toThrow("Invalid timestamp");
    });
  });

  describe("round-trip", () => {
    it("preserves all fields through JSON serialization", () => {
      const original = createTranscription({
        id: "1",
        sessionId: "session-1",
        text: "Hello world",
        timestamp: now,
        audioPath: "/audio/1.wav",
      });

      const restored = transcriptionFromJSON(transcriptionToJSON(original));

      expect(restored.id).toBe(original.id);
      expect(restored.sessionId).toBe(original.sessionId);
      expect(restored.text).toBe(original.text);
      expect(restored.audioPath).toBe(original.audioPath);
    });

    it("preserves Date equality via getTime()", () => {
      const original = createTranscription({
        id: "1",
        sessionId: "session-1",
        text: "Hello",
        timestamp: now,
        audioPath: "/audio/1.wav",
      });

      const restored = transcriptionFromJSON(transcriptionToJSON(original));
      expect(restored.timestamp.getTime()).toBe(original.timestamp.getTime());
    });
  });
});
