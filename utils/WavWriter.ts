import RNFS from 'react-native-fs';

import { FeatureFlag, logError } from './log';

const WAV_HEADER_SIZE = 44;

const createWavHeaderBuffer = (
  dataLength: number,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number
): string => {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const fileSize = dataLength + WAV_HEADER_SIZE - 8;

  const buffer = new ArrayBuffer(WAV_HEADER_SIZE);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  view.setUint8(0, 0x52); // R
  view.setUint8(1, 0x49); // I
  view.setUint8(2, 0x46); // F
  view.setUint8(3, 0x46); // F
  view.setUint32(4, fileSize, true);
  view.setUint8(8, 0x57); // W
  view.setUint8(9, 0x41); // A
  view.setUint8(10, 0x56); // V
  view.setUint8(11, 0x45); // E

  // fmt sub-chunk
  view.setUint8(12, 0x66); // f
  view.setUint8(13, 0x6d); // m
  view.setUint8(14, 0x74); // t
  view.setUint8(15, 0x20); // (space)
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  view.setUint8(36, 0x64); // d
  view.setUint8(37, 0x61); // a
  view.setUint8(38, 0x74); // t
  view.setUint8(39, 0x61); // a
  view.setUint32(40, dataLength, true);

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export interface PcmStreamWriter {
  write: (base64Chunk: string) => void;
  finalize: () => Promise<boolean>;
  abort: () => Promise<void>;
  getByteCount: () => number;
}

export const createPcmStreamWriter = (
  outputPath: string,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number = 16
): PcmStreamWriter => {
  const tempPath = `${outputPath}.pcm`;
  let totalBytes = 0;
  let writeQueue: Promise<void> = Promise.resolve();
  let hasError = false;
  let isFinalized = false;

  const write = (base64Chunk: string): void => {
    if (isFinalized || hasError) return;

    writeQueue = writeQueue.then(async () => {
      if (isFinalized || hasError) return;
      try {
        const decoded = atob(base64Chunk);
        totalBytes += decoded.length;
        if (totalBytes === decoded.length) {
          await RNFS.writeFile(tempPath, base64Chunk, 'base64');
        } else {
          await RNFS.appendFile(tempPath, base64Chunk, 'base64');
        }
      } catch (error) {
        hasError = true;
        logError(error, {
          flag: FeatureFlag.recording,
          message: 'Error writing PCM chunk to disk',
        });
      }
    });
  };

  const finalize = async (): Promise<boolean> => {
    if (isFinalized) return false;
    isFinalized = true;

    await writeQueue;

    if (hasError || totalBytes === 0) {
      await cleanup();
      return false;
    }

    try {
      const wavHeader = createWavHeaderBuffer(
        totalBytes,
        sampleRate,
        numChannels,
        bitsPerSample
      );
      await RNFS.writeFile(outputPath, wavHeader, 'base64');
      const pcmData = await RNFS.readFile(tempPath, 'base64');
      await RNFS.appendFile(outputPath, pcmData, 'base64');
      await RNFS.unlink(tempPath);
      return true;
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.recording,
        message: 'Error finalizing WAV file',
      });
      await cleanup();
      return false;
    }
  };

  const cleanup = async (): Promise<void> => {
    try {
      if (await RNFS.exists(tempPath)) {
        await RNFS.unlink(tempPath);
      }
    } catch {}
    try {
      if (await RNFS.exists(outputPath)) {
        await RNFS.unlink(outputPath);
      }
    } catch {}
  };

  const abort = async (): Promise<void> => {
    isFinalized = true;
    hasError = true;
    await writeQueue;
    await cleanup();
  };

  const getByteCount = (): number => totalBytes;

  return { write, finalize, abort, getByteCount };
};
