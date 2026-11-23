import type { SampleRange } from "@/utils";

export const FRAME_SAMPLES = 480;
const SAMPLE_RATE = 16000;
const FRAMES_PER_SECOND = SAMPLE_RATE / FRAME_SAMPLES;

// ponytail: energy-based speech detection and a fixed two-speaker split.
// Noisy rooms would want a real VAD (Silero ships in the sherpa binary), and
// more speakers a different clustering.
const SPEECH_RMS_FLOOR = 0.003;
const SPEECH_RMS_RELATIVE = 0.08;
const MIN_SILENCE_FRAMES = Math.round(0.3 * FRAMES_PER_SECOND);
const MIN_REGION_FRAMES = Math.round(0.24 * FRAMES_PER_SECOND);
/** Longest stretch judged as one voice: shorter follows quick exchanges
 *  better, longer gives the model more voice to go on. */
const MAX_PIECE_FRAMES = Math.round(2 * FRAMES_PER_SECOND);
const CUT_SEARCH_FRAMES = Math.round(0.4 * FRAMES_PER_SECOND);
/** Pieces shorter than this are labeled but don't shape the voice profiles. */
const CORE_PIECE_SAMPLES = SAMPLE_RATE;
const MAX_INITS = 8;
const MAX_ITERATIONS = 25;
/** Two profiles more alike than this are one person. */
const SAME_SPEAKER_SIMILARITY = 0.6;
/** A short piece this undecided takes its neighbor's speaker instead. */
const LOW_MARGIN = 0.1;

export interface SpeakerTurn extends SampleRange {
  speaker: number;
}

/** RMS per 30 ms frame; a trailing partial frame is dropped. */
export const frameRms = (pcm: Int16Array, out: number[]): void => {
  for (let f = 0; f + FRAME_SAMPLES <= pcm.length; f += FRAME_SAMPLES) {
    let sum = 0;
    for (let i = f; i < f + FRAME_SAMPLES; i++) {
      const s = pcm[i] / 32768;
      sum += s * s;
    }
    out.push(Math.sqrt(sum / FRAME_SAMPLES));
  }
};

const speechThreshold = (rms: number[]): number => {
  const sorted = Float64Array.from(rms).sort();
  const loud = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  return Math.max(SPEECH_RMS_FLOOR, loud * SPEECH_RMS_RELATIVE);
};

/**
 * Splits a recording into stretches of speech short enough to hold one voice:
 * at pauses, and inside long runs at the quietest frame near each even cut.
 */
export const findSpeechPieces = (rms: number[]): SampleRange[] => {
  const threshold = speechThreshold(rms);
  const regions: [number, number][] = [];
  let start = -1;
  let lastSpeech = -1;
  for (let f = 0; f <= rms.length; f++) {
    const isSpeech = f < rms.length && rms[f] >= threshold;
    if (isSpeech) {
      if (start < 0) start = f;
      lastSpeech = f;
    } else if (
      start >= 0 &&
      (f === rms.length || f - lastSpeech >= MIN_SILENCE_FRAMES)
    ) {
      if (lastSpeech + 1 - start >= MIN_REGION_FRAMES) {
        regions.push([start, lastSpeech + 1]);
      }
      start = -1;
    }
  }

  const pieces: SampleRange[] = [];
  for (const [regionStart, regionEnd] of regions) {
    const count = Math.ceil((regionEnd - regionStart) / MAX_PIECE_FRAMES);
    let from = regionStart;
    for (let i = 1; i <= count; i++) {
      let to = regionEnd;
      if (i < count) {
        const even =
          regionStart + Math.round(((regionEnd - regionStart) * i) / count);
        to = even;
        for (
          let f = Math.max(from + 1, even - CUT_SEARCH_FRAMES);
          f < Math.min(regionEnd, even + CUT_SEARCH_FRAMES);
          f++
        ) {
          if (rms[f] < rms[to]) to = f;
        }
      }
      pieces.push({
        startSample: from * FRAME_SAMPLES,
        endSample: to * FRAME_SAMPLES,
      });
      from = to;
    }
  }
  return pieces;
};

const dot = (a: ArrayLike<number>, b: ArrayLike<number>): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
};

const normalize = (v: ArrayLike<number>): Float64Array => {
  const norm = Math.sqrt(dot(v, v)) || 1;
  return Float64Array.from(v, (x) => x / norm);
};

interface Clustering {
  centroids: [Float64Array, Float64Array];
  score: number;
}

const twoMeans = (
  vectors: Float64Array[],
  weights: number[],
  seedA: number,
  seedB: number,
): Clustering => {
  let centroids: [Float64Array, Float64Array] = [
    vectors[seedA],
    vectors[seedB],
  ];
  let score = -Infinity;
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const sums = [
      new Float64Array(vectors[0].length),
      new Float64Array(vectors[0].length),
    ];
    let nextScore = 0;
    for (let i = 0; i < vectors.length; i++) {
      const a = dot(vectors[i], centroids[0]);
      const b = dot(vectors[i], centroids[1]);
      const label = b > a ? 1 : 0;
      nextScore += weights[i] * Math.max(a, b);
      for (let d = 0; d < vectors[i].length; d++) {
        sums[label][d] += weights[i] * vectors[i][d];
      }
    }
    if (nextScore <= score + 1e-9) break;
    score = nextScore;
    centroids = [
      dot(sums[0], sums[0]) > 0 ? normalize(sums[0]) : centroids[0],
      dot(sums[1], sums[1]) > 0 ? normalize(sums[1]) : centroids[1],
    ];
  }
  return { centroids, score };
};

/**
 * Labels each piece 0 or 1 from its voice embedding (empty = too short to
 * embed). Returns all 0 when the recording holds a single voice.
 */
export const clusterTwoSpeakers = (
  pieces: SampleRange[],
  embeddings: ArrayLike<number>[],
): number[] => {
  const labels = new Array<number>(pieces.length).fill(0);
  const vectors = embeddings.map((e) => (e.length > 0 ? normalize(e) : null));
  const duration = (i: number) => pieces[i].endSample - pieces[i].startSample;
  const core = pieces
    .map((_, i) => i)
    .filter((i) => vectors[i] && duration(i) >= CORE_PIECE_SAMPLES);
  if (core.length < 2) return labels;

  const coreVectors = core.map((i) => vectors[i]!);
  const coreWeights = core.map(duration);
  const step = Math.max(1, Math.floor(core.length / MAX_INITS));
  let best: Clustering | null = null;
  for (let seedA = 0; seedA < core.length; seedA += step) {
    let seedB = 0;
    let farthest = Infinity;
    for (let j = 0; j < core.length; j++) {
      const similarity = dot(coreVectors[seedA], coreVectors[j]);
      if (similarity < farthest) {
        farthest = similarity;
        seedB = j;
      }
    }
    const result = twoMeans(coreVectors, coreWeights, seedA, seedB);
    if (!best || result.score > best.score) best = result;
  }
  const [c0, c1] = best!.centroids;
  if (dot(c0, c1) > SAME_SPEAKER_SIMILARITY) return labels;

  const margins = vectors.map((v) => (v ? dot(v, c1) - dot(v, c0) : 0));
  const isUnsure = (i: number) =>
    !vectors[i] ||
    (duration(i) < CORE_PIECE_SAMPLES && Math.abs(margins[i]) < LOW_MARGIN);
  for (let i = 0; i < pieces.length; i++) {
    labels[i] = margins[i] > 0 ? 1 : 0;
  }
  // An unsure piece belongs with whichever sure neighbor it sits closest to.
  for (let i = 0; i < pieces.length; i++) {
    if (!isUnsure(i)) continue;
    let nearest = -1;
    let nearestGap = Infinity;
    for (const direction of [-1, 1]) {
      let j = i + direction;
      while (j >= 0 && j < pieces.length && isUnsure(j)) j += direction;
      if (j < 0 || j >= pieces.length) continue;
      const gap =
        direction < 0
          ? pieces[i].startSample - pieces[j].endSample
          : pieces[j].startSample - pieces[i].endSample;
      if (gap < nearestGap) {
        nearestGap = gap;
        nearest = j;
      }
    }
    if (nearest >= 0) labels[i] = labels[nearest];
  }
  return labels;
};

/**
 * Merges consecutive same-speaker pieces into turns that tile the whole
 * recording (cut mid-pause), numbering speakers in order of appearance.
 */
export const buildTurns = (
  pieces: SampleRange[],
  labels: number[],
  totalSamples: number,
  speakerIds: Map<number, number> = new Map(),
): SpeakerTurn[] => {
  const turns: SpeakerTurn[] = [];
  for (let i = 0; i < pieces.length; i++) {
    if (!speakerIds.has(labels[i])) speakerIds.set(labels[i], speakerIds.size);
    const speaker = speakerIds.get(labels[i])!;
    const last = turns[turns.length - 1];
    if (last?.speaker === speaker) {
      last.endSample = pieces[i].endSample;
    } else {
      turns.push({ ...pieces[i], speaker });
    }
  }
  for (let i = 0; i < turns.length; i++) {
    const next = turns[i + 1];
    const cut = next
      ? Math.round((turns[i].endSample + next.startSample) / 2)
      : totalSamples;
    turns[i].endSample = cut;
    if (next) next.startSample = cut;
  }
  if (turns.length > 0) turns[0].startSample = 0;
  return turns;
};
