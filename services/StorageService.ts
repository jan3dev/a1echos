import { Directory, File, Paths } from 'expo-file-system';
import {
  Transcription,
  TranscriptionJSON,
  transcriptionFromJSON,
  transcriptionToJSON,
} from '../models/Transcription';
import { encryptionService } from './EncryptionService';

const TRANSCRIPTIONS_FILE = 'transcriptions.json';
const PENDING_DELETES_FILE = 'pending_deletes.json';
const AUDIO_DIR = 'audio';

const createStorageService = () => {
  const getTranscriptionsFile = (): File => {
    return new File(Paths.document, TRANSCRIPTIONS_FILE);
  };

  const getPendingDeletesFile = (): File => {
    return new File(Paths.document, PENDING_DELETES_FILE);
  };

  const getAudioDirectory = (): Directory => {
    return new Directory(Paths.document, AUDIO_DIR);
  };

  const loadPendingDeletes = async (): Promise<string[]> => {
    try {
      const file = getPendingDeletesFile();

      if (!file.exists) {
        return [];
      }

      const contents = await file.text();

      if (!contents || contents.trim() === '') {
        return [];
      }

      const jsonList = JSON.parse(contents);
      return jsonList as string[];
    } catch (error) {
      console.error(
        'Failed to read pending deletes file. It may be corrupt.',
        error
      );

      const timestamp = Date.now();
      const file = getPendingDeletesFile();

      try {
        file.move(
          new File(
            Paths.document,
            `${PENDING_DELETES_FILE}.corrupted.${timestamp}`
          )
        );
        console.info(`Corrupted pending deletes file backed up`);
      } catch (renameError) {
        console.error(
          'Failed to rename corrupted pending deletes file',
          renameError
        );
      }

      return [];
    }
  };

  const savePendingDeletes = async (list: string[]): Promise<void> => {
    try {
      const file = getPendingDeletesFile();

      if (list.length === 0) {
        if (file.exists) {
          file.delete();
        }
        return;
      }

      const rawJson = JSON.stringify(list);
      file.write(rawJson);
    } catch (error) {
      console.error('Failed to save pending deletes', error);
      throw error;
    }
  };

  const processPendingDeletes = async (): Promise<void> => {
    const pending = await loadPendingDeletes();
    if (pending.length === 0) {
      return;
    }

    const stillPending: string[] = [];

    for (const path of pending) {
      let success = false;

      try {
        const file = new File(path);
        if (file.exists) {
          file.delete();
        }
        success = true;
      } catch (error) {
        console.error(
          `Error deleting file ${path}, attempting overwrite`,
          error
        );

        try {
          const file = new File(path);
          if (file.exists) {
            file.write('');
            file.delete();
          }
          success = true;
        } catch (error2) {
          console.error(`Second attempt failed deleting file ${path}`, error2);
        }
      }

      if (!success) {
        stillPending.push(path);
      }
    }

    await savePendingDeletes(stillPending);
  };

  const getTranscriptions = async (): Promise<Transcription[]> => {
    try {
      const file = getTranscriptionsFile();

      if (!file.exists) {
        return [];
      }

      const encrypted = await file.text();

      if (!encrypted || encrypted.trim() === '') {
        return [];
      }

      const jsonString = await encryptionService.decrypt(encrypted);
      const jsonList: TranscriptionJSON[] = JSON.parse(jsonString);

      return jsonList.map((json) => transcriptionFromJSON(json));
    } catch (error) {
      console.error('Error decrypting or parsing transcriptions', error);

      try {
        const file = getTranscriptionsFile();
        if (file.exists) {
          file.delete();
        }
      } catch (deleteError) {
        console.error(
          'Failed to delete corrupt transcriptions file',
          deleteError
        );
      }

      return [];
    }
  };

  const saveTranscriptions = async (
    transcriptions: Transcription[]
  ): Promise<void> => {
    const jsonList = transcriptions.map((t) => transcriptionToJSON(t));
    const rawJson = JSON.stringify(jsonList);
    const encrypted = await encryptionService.encrypt(rawJson);

    const file = getTranscriptionsFile();
    file.write(encrypted);
  };

  const saveTranscription = async (
    transcription: Transcription
  ): Promise<void> => {
    const transcriptions = await getTranscriptions();
    const existingIndex = transcriptions.findIndex(
      (t) => t.id === transcription.id
    );
    if (existingIndex >= 0) {
      transcriptions[existingIndex] = transcription;
    } else {
      transcriptions.push(transcription);
    }
    await saveTranscriptions(transcriptions);
  };

  const deleteTranscription = async (id: string): Promise<void> => {
    const transcriptions = await getTranscriptions();
    const toDelete = transcriptions.find((item) => item.id === id);
    const filtered = transcriptions.filter((item) => item.id !== id);

    await saveTranscriptions(filtered);

    if (toDelete?.audioPath && toDelete.audioPath.trim() !== '') {
      await deleteAudioFile(toDelete.audioPath);
    }
  };

  const clearTranscriptions = async (): Promise<void> => {
    const transcriptions = await getTranscriptions();

    await saveTranscriptions([]);

    for (const transcription of transcriptions) {
      if (transcription.audioPath && transcription.audioPath.trim() !== '') {
        await deleteAudioFile(transcription.audioPath);
      }
    }
  };

  const saveAudioFile = async (
    audioFilePath: string,
    fileName: string
  ): Promise<string> => {
    try {
      const dir = getAudioDirectory();

      if (!dir.exists) {
        dir.create({ intermediates: true });
      }

      const sourceFile = new File(audioFilePath);
      const targetFile = new File(dir, fileName);
      sourceFile.copy(targetFile);

      return targetFile.uri;
    } catch (error) {
      console.error(`Error saving audio file ${audioFilePath}`, error);
      throw error;
    }
  };

  const deleteAudioFile = async (path: string): Promise<void> => {
    try {
      const file = new File(path);
      if (file.exists) {
        file.delete();
      }
    } catch (error) {
      console.error(`Error deleting audio file ${path}`, error);

      let deletionStillPending = false;

      try {
        const file = new File(path);
        if (file.exists) {
          file.write('');
          file.delete();
        }
      } catch (error2) {
        console.error(`Second deletion attempt failed for ${path}`, error2);
        deletionStillPending = true;
      }

      if (deletionStillPending) {
        const pending = await loadPendingDeletes();
        if (!pending.includes(path)) {
          pending.push(path);
          await savePendingDeletes(pending);
        }
      }
    }
  };

  const deleteTranscriptionsForSession = async (
    sessionId: string
  ): Promise<void> => {
    const transcriptions = await getTranscriptions();
    const transcriptionsToKeep: Transcription[] = [];
    const audioPathsToDelete: string[] = [];

    for (const transcription of transcriptions) {
      if (transcription.sessionId === sessionId) {
        if (transcription.audioPath && transcription.audioPath.trim() !== '') {
          audioPathsToDelete.push(transcription.audioPath);
        }
      } else {
        transcriptionsToKeep.push(transcription);
      }
    }

    await saveTranscriptions(transcriptionsToKeep);

    for (const path of audioPathsToDelete) {
      await deleteAudioFile(path);
    }
  };

  return {
    processPendingDeletes,
    getTranscriptions,
    saveTranscription,
    deleteTranscription,
    clearTranscriptions,
    saveAudioFile,
    deleteTranscriptionsForSession,
  };
};

export const storageService = createStorageService();
export default storageService;
