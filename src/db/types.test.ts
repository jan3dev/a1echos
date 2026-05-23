import { Session, Transcription } from "@/models";

import { SessionRow, TranscriptionRow } from "./schema";
import {
  sessionFromRow,
  sessionToRow,
  transcriptionFromRow,
  transcriptionToRow,
} from "./types";

describe("db/types", () => {
  it("sessionToRow and sessionFromRow round-trip", () => {
    const session: Session = {
      id: "s1",
      name: "My session",
      timestamp: new Date("2024-03-15T10:00:00.000Z"),
      lastModified: new Date("2024-03-15T11:30:00.000Z"),
      isIncognito: true,
    };

    const row = sessionToRow(session);
    expect(row.id).toBe("s1");
    expect(row.name).toBe("My session");
    expect(row.timestampMs).toBe(session.timestamp.getTime());
    expect(row.lastModifiedMs).toBe(session.lastModified.getTime());
    expect(row.isIncognito).toBe(true);

    const back = sessionFromRow(row);
    expect(back).toEqual(session);
  });

  it("transcriptionToRow and transcriptionFromRow round-trip", () => {
    const t: Transcription = {
      id: "t1",
      sessionId: "s1",
      text: "Hello world",
      timestamp: new Date("2024-04-01T12:00:00.000Z"),
      audioPath: "/audio/test.wav",
    };

    const row = transcriptionToRow(t);
    expect(row).toEqual<TranscriptionRow>({
      id: "t1",
      sessionId: "s1",
      text: "Hello world",
      timestampMs: t.timestamp.getTime(),
      audioPath: "/audio/test.wav",
    });

    const back = transcriptionFromRow(row);
    expect(back).toEqual(t);
  });

  it("preserves empty audioPath", () => {
    const t: Transcription = {
      id: "t2",
      sessionId: "s1",
      text: "No audio",
      timestamp: new Date("2024-04-02T00:00:00.000Z"),
      audioPath: "",
    };
    const row = transcriptionToRow(t);
    expect(row.audioPath).toBe("");
    expect(transcriptionFromRow(row).audioPath).toBe("");
  });

  it("preserves boolean isIncognito = false", () => {
    const session: Session = {
      id: "s2",
      name: "Regular",
      timestamp: new Date("2024-01-01"),
      lastModified: new Date("2024-01-01"),
      isIncognito: false,
    };
    const row: SessionRow = sessionToRow(session);
    expect(row.isIncognito).toBe(false);
    expect(sessionFromRow(row).isIncognito).toBe(false);
  });
});
