import { desc, eq, inArray } from "drizzle-orm";

import { getDb, getRawDatabase } from "@/db";
import { meta, sessions, transcriptions } from "@/db/schema";
import {
  sessionFromRow,
  sessionToRow,
  transcriptionFromRow,
  transcriptionToRow,
} from "@/db/types";
import type { Session, Transcription } from "@/models";

const ACTIVE_SESSION_META_KEY = "active_session_id";

const extractAudioPaths = (rows: { audioPath: string }[]): string[] =>
  rows.map((r) => r.audioPath).filter((p) => p.trim() !== "");

const createDatabaseService = () => {
  const listSessions = async (): Promise<Session[]> => {
    const rows = await getDb()
      .select()
      .from(sessions)
      .orderBy(desc(sessions.lastModifiedMs))
      .all();
    return rows.map(sessionFromRow);
  };

  const upsertSession = async (session: Session): Promise<void> => {
    const row = sessionToRow(session);
    await getDb()
      .insert(sessions)
      .values(row)
      .onConflictDoUpdate({
        target: sessions.id,
        set: {
          name: row.name,
          timestampMs: row.timestampMs,
          lastModifiedMs: row.lastModifiedMs,
          isIncognito: row.isIncognito,
        },
      })
      .run();
  };

  const deleteSession = async (
    id: string,
  ): Promise<{ deletedAudioPaths: string[] }> => {
    const db = getDb();
    // Capture audio paths and delete inside a single transaction so a
    // concurrent writer can't change the audio-path set between the read
    // and the cascade.
    let deletedAudioPaths: string[] = [];
    await db.transaction(async (tx) => {
      const rows = await tx
        .select({ audioPath: transcriptions.audioPath })
        .from(transcriptions)
        .where(eq(transcriptions.sessionId, id))
        .all();
      deletedAudioPaths = extractAudioPaths(rows);
      await tx.delete(sessions).where(eq(sessions.id, id)).run();
    });
    return { deletedAudioPaths };
  };

  const getActiveSessionId = async (): Promise<string | null> => {
    const row = await getDb()
      .select()
      .from(meta)
      .where(eq(meta.key, ACTIVE_SESSION_META_KEY))
      .get();
    if (!row || !row.value || row.value.trim() === "") {
      return null;
    }
    return row.value;
  };

  const setActiveSessionId = async (id: string | null): Promise<void> => {
    const db = getDb();
    if (id === null || id.trim() === "") {
      await db.delete(meta).where(eq(meta.key, ACTIVE_SESSION_META_KEY)).run();
      return;
    }
    await db
      .insert(meta)
      .values({ key: ACTIVE_SESSION_META_KEY, value: id })
      .onConflictDoUpdate({
        target: meta.key,
        set: { value: id },
      })
      .run();
  };

  const listTranscriptions = async (): Promise<Transcription[]> => {
    const rows = await getDb()
      .select()
      .from(transcriptions)
      .orderBy(transcriptions.timestampMs)
      .all();
    return rows.map(transcriptionFromRow);
  };

  const listTranscriptionsForSession = async (
    sessionId: string,
  ): Promise<Transcription[]> => {
    const rows = await getDb()
      .select()
      .from(transcriptions)
      .where(eq(transcriptions.sessionId, sessionId))
      .orderBy(transcriptions.timestampMs)
      .all();
    return rows.map(transcriptionFromRow);
  };

  const upsertTranscription = async (t: Transcription): Promise<void> => {
    const row = transcriptionToRow(t);
    await getDb()
      .insert(transcriptions)
      .values(row)
      .onConflictDoUpdate({
        target: transcriptions.id,
        set: {
          sessionId: row.sessionId,
          text: row.text,
          timestampMs: row.timestampMs,
          audioPath: row.audioPath,
        },
      })
      .run();
  };

  const deleteTranscription = async (
    id: string,
  ): Promise<{ audioPath: string | null }> => {
    const db = getDb();
    let audioPath: string | null = null;
    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ audioPath: transcriptions.audioPath })
        .from(transcriptions)
        .where(eq(transcriptions.id, id))
        .get();
      await tx.delete(transcriptions).where(eq(transcriptions.id, id)).run();
      audioPath = existing?.audioPath?.trim() ? existing.audioPath : null;
    });
    return { audioPath };
  };

  const deleteTranscriptions = async (
    ids: string[],
  ): Promise<{ audioPaths: string[] }> => {
    if (ids.length === 0) return { audioPaths: [] };
    const db = getDb();
    let audioPaths: string[] = [];
    await db.transaction(async (tx) => {
      const rows = await tx
        .select({ audioPath: transcriptions.audioPath })
        .from(transcriptions)
        .where(inArray(transcriptions.id, ids))
        .all();
      audioPaths = extractAudioPaths(rows);
      await tx
        .delete(transcriptions)
        .where(inArray(transcriptions.id, ids))
        .run();
    });
    return { audioPaths };
  };

  const clearAllTranscriptions = async (): Promise<{
    audioPaths: string[];
  }> => {
    const db = getDb();
    let audioPaths: string[] = [];
    await db.transaction(async (tx) => {
      const rows = await tx
        .select({ audioPath: transcriptions.audioPath })
        .from(transcriptions)
        .all();
      audioPaths = extractAudioPaths(rows);
      await tx.delete(transcriptions).run();
    });
    return { audioPaths };
  };

  const vacuum = async (): Promise<void> => {
    await getRawDatabase().execAsync("VACUUM;");
  };

  return {
    listSessions,
    upsertSession,
    deleteSession,
    getActiveSessionId,
    setActiveSessionId,
    listTranscriptions,
    listTranscriptionsForSession,
    upsertTranscription,
    deleteTranscription,
    deleteTranscriptions,
    clearAllTranscriptions,
    vacuum,
  };
};

export const databaseService = createDatabaseService();
export default databaseService;
