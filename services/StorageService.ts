import { Directory, File, Paths } from 'expo-file-system';
import {
    Transcription,
    TranscriptionJSON,
    transcriptionFromJSON,
    transcriptionToJSON,
} from '../models/Transcription';
import { EncryptionService } from './EncryptionService';

const TRANSCRIPTIONS_FILE = 'transcriptions.json';
const PENDING_DELETES_FILE = 'pending_deletes.json';
const AUDIO_DIR = 'audio';

export class StorageService {
  private static instance: StorageService;
  private encryptionService: EncryptionService;

  private constructor() {
    this.encryptionService = EncryptionService.getInstance();
  }

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  private get transcriptionsFile(): File {
    return new File(Paths.document, TRANSCRIPTIONS_FILE);
  }

  private get pendingDeletesFile(): File {
    return new File(Paths.document, PENDING_DELETES_FILE);
  }

  private get audioDirectory(): Directory {
    return new Directory(Paths.document, AUDIO_DIR);
  }

  private async loadPendingDeletes(): Promise<string[]> {
    try {
      const file = this.pendingDeletesFile;

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
      const file = this.pendingDeletesFile;

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
  }

  private async savePendingDeletes(list: string[]): Promise<void> {
    try {
      const file = this.pendingDeletesFile;

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
  }

  async processPendingDeletes(): Promise<void> {
    const pending = await this.loadPendingDeletes();
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

    await this.savePendingDeletes(stillPending);
  }

  async getTranscriptions(): Promise<Transcription[]> {
    try {
      const file = this.transcriptionsFile;

      if (!file.exists) {
        return [];
      }

      const encrypted = await file.text();

      if (!encrypted || encrypted.trim() === '') {
        return [];
      }

      const jsonString = await this.encryptionService.decrypt(encrypted);
      const jsonList: TranscriptionJSON[] = JSON.parse(jsonString);

      return jsonList.map((json) => transcriptionFromJSON(json));
    } catch (error) {
      console.error('Error decrypting or parsing transcriptions', error);

      try {
        const file = this.transcriptionsFile;
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
  }

  private async saveTranscriptions(
    transcriptions: Transcription[]
  ): Promise<void> {
    const jsonList = transcriptions.map((t) => transcriptionToJSON(t));
    const rawJson = JSON.stringify(jsonList);
    const encrypted = await this.encryptionService.encrypt(rawJson);

    const file = this.transcriptionsFile;
    file.write(encrypted);
  }

  async saveTranscription(transcription: Transcription): Promise<void> {
    const transcriptions = await this.getTranscriptions();
    const existingIndex = transcriptions.findIndex(
      (t) => t.id === transcription.id
    );
    if (existingIndex >= 0) {
      transcriptions[existingIndex] = transcription;
    } else {
      transcriptions.push(transcription);
    }
    await this.saveTranscriptions(transcriptions);
  }

  async deleteTranscription(id: string): Promise<void> {
    const transcriptions = await this.getTranscriptions();
    const toDelete = transcriptions.find((item) => item.id === id);
    const filtered = transcriptions.filter((item) => item.id !== id);

    await this.saveTranscriptions(filtered);

    if (toDelete?.audioPath && toDelete.audioPath.trim() !== '') {
      await this.deleteAudioFile(toDelete.audioPath);
    }
  }

  async clearTranscriptions(): Promise<void> {
    const transcriptions = await this.getTranscriptions();

    await this.saveTranscriptions([]);

    for (const transcription of transcriptions) {
      if (transcription.audioPath && transcription.audioPath.trim() !== '') {
        await this.deleteAudioFile(transcription.audioPath);
      }
    }
  }

  async saveAudioFile(
    audioFilePath: string,
    fileName: string
  ): Promise<string> {
    try {
      const dir = this.audioDirectory;

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
  }

  private async deleteAudioFile(path: string): Promise<void> {
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
        const pending = await this.loadPendingDeletes();
        if (!pending.includes(path)) {
          pending.push(path);
          await this.savePendingDeletes(pending);
        }
      }
    }
  }

  async deleteTranscriptionsForSession(sessionId: string): Promise<void> {
    const transcriptions = await this.getTranscriptions();
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

    await this.saveTranscriptions(transcriptionsToKeep);

    for (const path of audioPathsToDelete) {
      await this.deleteAudioFile(path);
    }
  }
}

export default StorageService.getInstance();
