import type { Folder, Session, Transcription } from "@/models";

import type { FolderRow, SessionRow, TranscriptionRow } from "./schema";

export function sessionFromRow(row: SessionRow): Session {
  return {
    id: row.id,
    name: row.name,
    timestamp: new Date(row.timestampMs),
    lastModified: new Date(row.lastModifiedMs),
    isIncognito: row.isIncognito,
    ...(row.folderId && { folderId: row.folderId }),
  };
}

export function sessionToRow(session: Session): SessionRow {
  return {
    id: session.id,
    name: session.name,
    timestampMs: session.timestamp.getTime(),
    lastModifiedMs: session.lastModified.getTime(),
    isIncognito: session.isIncognito,
    folderId: session.folderId ?? null,
  };
}

export function folderFromRow(row: FolderRow): Folder {
  return {
    id: row.id,
    name: row.name,
    createdAt: new Date(row.createdAtMs),
  };
}

export function folderToRow(folder: Folder): FolderRow {
  return {
    id: folder.id,
    name: folder.name,
    createdAtMs: folder.createdAt.getTime(),
  };
}

export function transcriptionFromRow(row: TranscriptionRow): Transcription {
  return {
    id: row.id,
    sessionId: row.sessionId,
    text: row.text,
    timestamp: new Date(row.timestampMs),
    audioPath: row.audioPath,
  };
}

export function transcriptionToRow(t: Transcription): TranscriptionRow {
  return {
    id: t.id,
    sessionId: t.sessionId,
    text: t.text,
    timestampMs: t.timestamp.getTime(),
    audioPath: t.audioPath,
  };
}
