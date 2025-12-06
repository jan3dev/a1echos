import { Share } from 'react-native';
import { Transcription } from '../models/Transcription';

const createShareService = () => {
  const shareTranscriptions = async (
    transcriptions: Transcription[]
  ): Promise<void> => {
    if (transcriptions.length === 0) {
      throw new Error('Cannot share empty transcription list');
    }

    const content = formatTranscriptions(transcriptions);

    await Share.share({
      message: content,
    });
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
