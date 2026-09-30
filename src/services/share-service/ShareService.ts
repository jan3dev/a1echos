import * as Clipboard from "expo-clipboard";
import { Directory } from "expo-file-system";
import { Share } from "react-native";

import { Session, Transcription } from "@/models";

export interface SessionContent {
  session: Session;
  transcriptions: Transcription[];
}

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
    [`# ${session.name}`, ...transcriptions.map((t) => t.text)].join("\n\n") +
    "\n";

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
    let directory: Directory;
    try {
      directory = await Directory.pickDirectoryAsync();
    } catch {
      return false;
    }
    // iOS `createFile` throws on an existing name; Android dedupes on its own.
    const taken = new Set(directory.list().map((entry) => entry.name));
    for (const content of contents) {
      const base =
        content.session.name.replace(/[\\/:*?"<>|]/g, "-").trim() || "Session";
      let name = `${base}.md`;
      for (let n = 2; taken.has(name); n++) name = `${base} (${n}).md`;
      taken.add(name);
      directory.createFile(name, "text/markdown").write(toMarkdown(content));
    }
    return true;
  };

  return {
    shareTranscriptions,
    copySessions,
    shareSessions,
    saveSessionsMarkdown,
  };
};

export const shareService = createShareService();
export default shareService;
