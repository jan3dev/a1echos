import * as Clipboard from "expo-clipboard";
import { Directory, File, FileMode } from "expo-file-system";
import { Share } from "react-native";

import { Session, Transcription } from "@/models";

export interface SessionContent {
  session: Session;
  transcriptions: Transcription[];
}

const TIMESTAMP_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const AUDIO_NAME_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const COPY_CHUNK_BYTES = 1024 * 1024;

/** iOS `createFile` throws on an existing name; Android dedupes on its own. */
const uniqueName = (taken: Set<string>, base: string, extension: string) => {
  let name = `${base}${extension}`;
  for (let n = 2; taken.has(name); n++) name = `${base} (${n})${extension}`;
  taken.add(name);
  return name;
};

const pickDirectory = async (): Promise<Directory | null> => {
  try {
    return await Directory.pickDirectoryAsync();
  } catch {
    return null;
  }
};

const createShareService = () => {
  const shareTranscriptions = async (
    transcriptions: Transcription[],
  ): Promise<void> => {
    if (transcriptions.length === 0) {
      throw new Error("Cannot share empty transcription list");
    }

    const content = formatTranscriptions(transcriptions);

    await Share.share({
      message: content,
    });
  };

  const formatTranscriptions = (transcriptions: Transcription[]): string => {
    return transcriptions.map((t) => t.text).join("\n\n");
  };

  const formatSessions = (contents: SessionContent[]): string =>
    contents
      .map((c) => formatTranscriptions(c.transcriptions))
      .filter(Boolean)
      .join("\n\n");

  const toMarkdown = ({ session, transcriptions }: SessionContent): string =>
    [
      `# ${session.name}`,
      ...transcriptions.map(
        (t) => `## ${TIMESTAMP_FORMAT.format(t.timestamp)}\n\n${t.text}`,
      ),
    ].join("\n\n") + "\n";

  const copySessions = (contents: SessionContent[]) =>
    Clipboard.setStringAsync(formatSessions(contents));

  const shareSessions = async (contents: SessionContent[]) => {
    await Share.share({ message: formatSessions(contents) });
  };

  /**
   * Writes one `.md` per session into a user-picked folder. Resolves `false`
   * when the picker is dismissed.
   */
  const saveSessionsMarkdown = async (
    contents: SessionContent[],
  ): Promise<boolean> => {
    const directory = await pickDirectory();
    if (!directory) return false;
    const taken = new Set(directory.list().map((entry) => entry.name));
    for (const content of contents) {
      const base =
        content.session.name.replace(/[\\/:*?"<>|]/g, "-").trim() || "Session";
      directory
        .createFile(uniqueName(taken, base, ".md"), "text/markdown")
        .writeSync(toMarkdown(content));
    }
    return true;
  };

  /**
   * Copies a plaintext WAV, as is, into a user-picked folder as
   * `Echos Apr 18, 7.18 AM.wav`. Resolves `false` when the picker is
   * dismissed; `onWriteStart` fires once the folder is picked.
   */
  const saveAudioWav = async (
    sourceUri: string,
    recordedAt: Date,
    onWriteStart?: () => void,
  ): Promise<boolean> => {
    const directory = await pickDirectory();
    if (!directory) return false;
    onWriteStart?.();
    const source = new File(sourceUri).open(FileMode.ReadOnly);
    try {
      const base = `Echos ${AUDIO_NAME_FORMAT.format(recordedAt)}`
        .replace(/:/g, ".")
        // Device ICU puts a narrow no-break space before AM/PM.
        .replace(/\s/g, " ");
      const taken = new Set(directory.list().map((entry) => entry.name));
      const target = directory.createFile(
        uniqueName(taken, base, ".wav"),
        "audio/x-wav",
      );
      try {
        const sink = target.open(FileMode.WriteOnly);
        try {
          // Chunked so a long recording never sits in memory whole.
          let chunk: Uint8Array;
          while ((chunk = await source.readBytes(COPY_CHUNK_BYTES)).length) {
            await sink.writeBytes(chunk);
          }
        } finally {
          sink.close();
        }
      } catch (error) {
        try {
          target.delete();
        } catch {}
        throw error;
      }
    } finally {
      source.close();
    }
    return true;
  };

  return {
    shareTranscriptions,
    copySessions,
    shareSessions,
    saveSessionsMarkdown,
    saveAudioWav,
  };
};

export const shareService = createShareService();
export default shareService;
