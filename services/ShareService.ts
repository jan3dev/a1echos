import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Transcription } from '../models/Transcription';

const createShareService = () => {
  const shareTranscriptions = async (
    transcriptions: Transcription[]
  ): Promise<void> => {
    if (transcriptions.length === 0) {
      throw new Error('Cannot share empty transcription list');
    }

    const content = formatTranscriptions(transcriptions);

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }

    const tempFile = new File(Paths.cache, `${Date.now()}-transcription.txt`);
    tempFile.write(content);

    await Sharing.shareAsync(tempFile.uri, {
      mimeType: 'text/plain',
      dialogTitle: 'Share Transcription',
    });

    tempFile.delete();
  };

  const formatTranscriptions = (transcriptions: Transcription[]): string => {
    return transcriptions.map((t) => t.text).join('\n\n');
  };

  return {
    shareTranscriptions,
  };
};

export const shareService = createShareService();
export default shareService;
