import {
  createSession,
  sessionToJSON,
  sessionFromJSON,
  Session,
  SessionJSON,
} from "./Session";

describe("Session", () => {
  const now = new Date("2025-06-15T12:00:00.000Z");
  const later = new Date("2025-06-15T13:00:00.000Z");

  describe("createSession", () => {
    it("returns correct Session with all params", () => {
      const session = createSession({
        id: "1",
        name: "Test",
        timestamp: now,
        lastModified: later,
        isIncognito: true,
      });

      expect(session).toEqual({
        id: "1",
        name: "Test",
        timestamp: now,
        lastModified: later,
        isIncognito: true,
      });
    });

    it("defaults lastModified to timestamp when omitted", () => {
      const session = createSession({ id: "1", name: "Test", timestamp: now });
      expect(session.lastModified).toBe(now);
    });

    it("defaults isIncognito to false when omitted", () => {
      const session = createSession({ id: "1", name: "Test", timestamp: now });
      expect(session.isIncognito).toBe(false);
    });
  });

  describe("sessionToJSON", () => {
    const session: Session = {
      id: "1",
      name: "Test",
      timestamp: now,
      lastModified: later,
      isIncognito: true,
    };

    it("converts Dates to ISO strings", () => {
      const json = sessionToJSON(session);
      expect(json.timestamp).toBe("2025-06-15T12:00:00.000Z");
      expect(json.lastModified).toBe("2025-06-15T13:00:00.000Z");
    });

    it("includes all fields", () => {
      const json = sessionToJSON(session);
      expect(json).toEqual({
        id: "1",
        name: "Test",
        timestamp: "2025-06-15T12:00:00.000Z",
        lastModified: "2025-06-15T13:00:00.000Z",
        isIncognito: true,
      });
    });
  });

  describe("sessionFromJSON", () => {
    it("parses ISO strings back to Dates", () => {
      const json: SessionJSON = {
        id: "1",
        name: "Test",
        timestamp: "2025-06-15T12:00:00.000Z",
        lastModified: "2025-06-15T13:00:00.000Z",
        isIncognito: true,
      };
      const session = sessionFromJSON(json);
      expect(session.timestamp).toBeInstanceOf(Date);
      expect(session.lastModified).toBeInstanceOf(Date);
    });

    it("falls back to timestamp when lastModified missing", () => {
      const json: SessionJSON = {
        id: "1",
        name: "Test",
        timestamp: "2025-06-15T12:00:00.000Z",
      };
      const session = sessionFromJSON(json);
      expect(session.lastModified.getTime()).toBe(session.timestamp.getTime());
    });

    it("defaults isIncognito to false when missing", () => {
      const json: SessionJSON = {
        id: "1",
        name: "Test",
        timestamp: "2025-06-15T12:00:00.000Z",
      };
      expect(sessionFromJSON(json).isIncognito).toBe(false);
    });
  });

  describe("round-trip", () => {
    it("preserves all fields through JSON serialization", () => {
      const original = createSession({
        id: "1",
        name: "Test",
        timestamp: now,
        lastModified: later,
        isIncognito: true,
      });

      const restored = sessionFromJSON(sessionToJSON(original));

      expect(restored.id).toBe(original.id);
      expect(restored.name).toBe(original.name);
      expect(restored.isIncognito).toBe(original.isIncognito);
    });

    it("preserves Date equality via getTime()", () => {
      const original = createSession({
        id: "1",
        name: "Test",
        timestamp: now,
        lastModified: later,
      });

      const restored = sessionFromJSON(sessionToJSON(original));

      expect(restored.timestamp.getTime()).toBe(original.timestamp.getTime());
      expect(restored.lastModified.getTime()).toBe(
        original.lastModified.getTime(),
      );
    });
  });
});
