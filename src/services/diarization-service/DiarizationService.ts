import { File } from "expo-file-system";

import { type SampleRange, WAV_HEADER_SIZE } from "@/utils";
import { EchosDiarization } from "@modules/echos-diarization/src";

import {
  buildTurns,
  clusterTwoSpeakers,
  findSpeechPieces,
  FRAME_SAMPLES,
  frameRms,
  type SpeakerTurn,
} from "./speakerTurns";

const WINDOW_BYTES = FRAME_SAMPLES * 2 * 1000;
const EMBED_BATCH = 16;

export class SpeakerIdentificationCancelledError extends Error {}

export interface SpeakerTurnsResult {
  /** Turns per input file, tiling it; empty for a file without speech. */
  turns: SpeakerTurn[][];
  speakerCount: number;
}

interface IdentifyOptions {
  /** Fraction of the audio analyzed so far, 0–1. */
  onProgress?: (fraction: number) => void;
  isCancelled?: () => boolean;
}

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Streams a 16 kHz mono 16-bit WAV from disk so memory stays flat. */
const scanWav = async (
  uri: string,
): Promise<{ pieces: SampleRange[]; totalSamples: number }> => {
  const handle = new File(uri).open();
  try {
    const totalBytes = handle.size ?? 0;
    handle.offset = WAV_HEADER_SIZE;
    const rms: number[] = [];
    for (;;) {
      const remaining = totalBytes - (handle.offset ?? totalBytes);
      if (remaining < FRAME_SAMPLES * 2) break;
      const bytes = handle.readBytesSync(Math.min(WINDOW_BYTES, remaining));
      if (bytes.length === 0) break;
      const aligned = bytes.byteOffset % 2 === 0 ? bytes : bytes.slice();
      frameRms(
        new Int16Array(
          aligned.buffer,
          aligned.byteOffset,
          aligned.byteLength >> 1,
        ),
        rms,
      );
      await yieldToUi();
    }
    return {
      pieces: findSpeechPieces(rms),
      totalSamples: Math.max(0, totalBytes - WAV_HEADER_SIZE) >> 1,
    };
  } finally {
    handle.close();
  }
};

const createDiarizationService = () => {
  /**
   * Works out who speaks when across recordings of the same two people, so
   * "speaker 0" is the same person in every file.
   */
  const identifyTurns = async (
    wavUris: string[],
    modelUri: string,
    { onProgress, isCancelled }: IdentifyOptions = {},
  ): Promise<SpeakerTurnsResult> => {
    if (!EchosDiarization) throw new Error("Speaker module unavailable");
    const throwIfCancelled = () => {
      if (isCancelled?.()) throw new SpeakerIdentificationCancelledError();
    };

    try {
      const files = [];
      for (const uri of wavUris) {
        throwIfCancelled();
        files.push(await scanWav(uri));
      }
      const totalPieces = files.reduce((n, f) => n + f.pieces.length, 0);

      // On one timeline, so a piece's neighbors in the previous or next file
      // count as near or far the same way as within a file.
      const timeline: SampleRange[] = [];
      const embeddings: number[][] = [];
      let fileStart = 0;
      for (let f = 0; f < files.length; f++) {
        const { pieces, totalSamples } = files[f];
        for (let i = 0; i < pieces.length; i += EMBED_BATCH) {
          throwIfCancelled();
          const batch = pieces.slice(i, i + EMBED_BATCH);
          embeddings.push(
            ...(await EchosDiarization.embed(
              wavUris[f],
              modelUri,
              batch.flatMap((p) => [p.startSample, p.endSample]),
            )),
          );
          onProgress?.(embeddings.length / totalPieces);
        }
        for (const piece of pieces) {
          timeline.push({
            startSample: fileStart + piece.startSample,
            endSample: fileStart + piece.endSample,
          });
        }
        fileStart += totalSamples;
      }

      const labels = clusterTwoSpeakers(timeline, embeddings);
      const speakerIds = new Map<number, number>();
      let offset = 0;
      const turns = files.map(({ pieces, totalSamples }) => {
        const fileLabels = labels.slice(offset, offset + pieces.length);
        offset += pieces.length;
        return buildTurns(pieces, fileLabels, totalSamples, speakerIds);
      });
      return { turns, speakerCount: speakerIds.size };
    } finally {
      await EchosDiarization.release().catch(() => {});
    }
  };

  return { identifyTurns };
};

export const diarizationService = createDiarizationService();
