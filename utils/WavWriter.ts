import { File } from "expo-file-system";

import { FeatureFlag, logError } from "./log";

const WAV_HEADER_SIZE = 44;

/**
 * Build a 44-byte WAV header for a PCM payload of the given length. The header
 * is complete — dataLength and fileSize fields are filled at call time, so the
 * writer can emit it without needing to patch bytes later.
 */
const createWavHeaderBytes = (
  dataLength: number,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number,
): Uint8Array => {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const fileSize = dataLength + WAV_HEADER_SIZE - 8;

  const buffer = new ArrayBuffer(WAV_HEADER_SIZE);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
  };

  // RIFF chunk descriptor
  writeAscii(0, "RIFF");
  view.setUint32(4, fileSize, true);
  writeAscii(8, "WAVE");

  // fmt sub-chunk
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeAscii(36, "data");
  view.setUint32(40, dataLength, true);

  return new Uint8Array(buffer);
};

export interface PcmStreamWriter {
  /** Append raw little-endian PCM bytes to the in-progress recording. */
  write: (bytes: Uint8Array) => void;
  /** Flush queued writes, prepend the WAV header, return success. */
  finalize: () => Promise<boolean>;
  /** Cancel: drop queued writes and remove any files on disk. */
  abort: () => Promise<void>;
  getByteCount: () => number;
}

export const createPcmStreamWriter = (
  outputUri: string,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number = 16,
): PcmStreamWriter => {
  const tempFile = new File(`${outputUri}.pcm`);
  const outputFile = new File(outputUri);

  let totalBytes = 0;
  let writeQueue: Promise<void> = Promise.resolve();
  let hasError = false;
  let isFinalized = false;

  const write = (bytes: Uint8Array): void => {
    if (isFinalized || hasError) return;

    const isFirst = totalBytes === 0;
    totalBytes += bytes.byteLength;

    writeQueue = writeQueue.then(async () => {
      if (isFinalized || hasError) return;
      try {
        tempFile.write(bytes, isFirst ? undefined : { append: true });
      } catch (error) {
        hasError = true;
        logError(error, {
          flag: FeatureFlag.recording,
          message: "Error writing PCM chunk to disk",
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
      const header = createWavHeaderBytes(
        totalBytes,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      outputFile.write(header);
      const pcm = tempFile.bytesSync();
      outputFile.write(pcm, { append: true });
      if (tempFile.exists) tempFile.delete();
      return true;
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.recording,
        message: "Error finalizing WAV file",
      });
      await cleanup();
      return false;
    }
  };

  const deleteIfExists = (file: File, label: string): void => {
    if (!file.exists) return;
    try {
      file.delete();
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.recording,
        message: `Error deleting ${label} during WAV cleanup`,
      });
    }
  };

  const cleanup = async (): Promise<void> => {
    deleteIfExists(tempFile, "temp PCM file");
    deleteIfExists(outputFile, "output WAV file");
  };

  const abort = async (): Promise<void> => {
    if (isFinalized) return;
    isFinalized = true;
    hasError = true;
    await writeQueue;
    await cleanup();
  };

  const getByteCount = (): number => totalBytes;

  return { write, finalize, abort, getByteCount };
};
