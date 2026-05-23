import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  timestampMs: integer("timestamp_ms").notNull(),
  lastModifiedMs: integer("last_modified_ms").notNull(),
  isIncognito: integer("is_incognito", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const transcriptions = sqliteTable(
  "transcriptions",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    timestampMs: integer("timestamp_ms").notNull(),
    audioPath: text("audio_path").notNull().default(""),
  },
  (t) => ({
    sessionIdIdx: index("transcriptions_session_id_idx").on(t.sessionId),
    timestampIdx: index("transcriptions_timestamp_idx").on(t.timestampMs),
  }),
);

export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type SessionRow = typeof sessions.$inferSelect;
export type SessionInsert = typeof sessions.$inferInsert;
export type TranscriptionRow = typeof transcriptions.$inferSelect;
export type TranscriptionInsert = typeof transcriptions.$inferInsert;
export type MetaRow = typeof meta.$inferSelect;
