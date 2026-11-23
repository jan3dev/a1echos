import {
  buildTurns,
  clusterTwoSpeakers,
  findSpeechPieces,
  FRAME_SAMPLES,
  frameRms,
} from "./speakerTurns";

const SECOND = 16000;
const FRAMES_PER_SECOND = SECOND / FRAME_SAMPLES;
const LOUD = 0.05;
const QUIET = 0.0005;

/** [seconds, level] runs → per-frame RMS. */
const rmsOf = (...runs: [number, number][]): number[] =>
  runs.flatMap(([seconds, level]) =>
    new Array(Math.round(seconds * FRAMES_PER_SECOND)).fill(level),
  );

const seconds = (r: { startSample: number; endSample: number }) => [
  r.startSample / SECOND,
  r.endSample / SECOND,
];

const piece = (start: number, end: number) => ({
  startSample: start * SECOND,
  endSample: end * SECOND,
});

const VOICE_A = [1, 0.1, 0];
const VOICE_B = [0.1, 1, 0];
/** A voice with a little variation, as real embeddings have. */
const like = (voice: number[], wobble: number) => [voice[0], voice[1], wobble];

describe("frameRms", () => {
  it("measures each whole 30 ms frame and drops the partial tail", () => {
    const pcm = new Int16Array(FRAME_SAMPLES * 2 + 100).fill(16384);
    pcm.fill(0, FRAME_SAMPLES, FRAME_SAMPLES * 2);
    const out: number[] = [];
    frameRms(pcm, out);
    expect(out).toEqual([0.5, 0]);
  });
});

describe("findSpeechPieces", () => {
  it("finds nothing in silence or an empty recording", () => {
    expect(findSpeechPieces(rmsOf([3, QUIET]))).toEqual([]);
    expect(findSpeechPieces([])).toEqual([]);
  });

  it("splits at pauses", () => {
    const pieces = findSpeechPieces(
      rmsOf([0.6, QUIET], [1.2, LOUD], [0.6, QUIET], [0.9, LOUD], [0.6, QUIET]),
    );
    expect(pieces.map(seconds)).toEqual([
      [0.6, 1.8],
      [2.4, 3.3],
    ]);
  });

  it("bridges gaps too short to be a pause", () => {
    const pieces = findSpeechPieces(
      rmsOf([0.6, LOUD], [0.15, QUIET], [0.6, LOUD], [0.6, QUIET]),
    );
    expect(pieces.map(seconds)).toEqual([[0, 1.35]]);
  });

  it("drops blips too short to be speech", () => {
    const pieces = findSpeechPieces(
      rmsOf([0.6, QUIET], [0.12, LOUD], [0.6, QUIET], [0.9, LOUD]),
    );
    expect(pieces.map(seconds)).toEqual([[1.32, 2.22]]);
  });

  it("keeps speech that runs to the end of the recording", () => {
    const pieces = findSpeechPieces(rmsOf([0.6, QUIET], [0.9, LOUD]));
    expect(pieces.map(seconds)).toEqual([[0.6, 1.5]]);
  });

  it("cuts long speech into short pieces at the quietest frame nearby", () => {
    // 5.1 s of speech → 3 pieces; a dip sits 0.3 s before the first even cut.
    const rms = rmsOf([5.1, LOUD], [0.6, QUIET]);
    const dip = Math.round((5.1 / 3 - 0.3) * FRAMES_PER_SECOND);
    rms[dip] = LOUD / 4;

    const pieces = findSpeechPieces(rms);

    expect(pieces).toHaveLength(3);
    expect(pieces[0].startSample).toBe(0);
    expect(pieces[0].endSample).toBe(dip * FRAME_SAMPLES);
    expect(pieces[1].startSample).toBe(pieces[0].endSample);
    expect(pieces[2].startSample).toBe(pieces[1].endSample);
    expect(pieces[2].endSample).toBe(5.1 * SECOND);
    for (const p of pieces) {
      expect(p.endSample - p.startSample).toBeLessThanOrEqual(2.4 * SECOND);
    }
  });

  it("adapts to a noisy room instead of calling everything speech", () => {
    const pieces = findSpeechPieces(
      rmsOf([0.6, 0.008], [1.2, 0.3], [0.6, 0.008]),
    );
    expect(pieces.map(seconds)).toEqual([[0.6, 1.8]]);
  });
});

describe("clusterTwoSpeakers", () => {
  it("tells two alternating voices apart", () => {
    const pieces = [
      piece(0, 2),
      piece(2, 4),
      piece(5, 7),
      piece(7, 9),
      piece(10, 12),
    ];
    const labels = clusterTwoSpeakers(pieces, [
      like(VOICE_A, 0.1),
      like(VOICE_A, -0.1),
      like(VOICE_B, 0.1),
      like(VOICE_B, -0.1),
      like(VOICE_A, 0.05),
    ]);
    expect(labels[0]).toBe(labels[1]);
    expect(labels[2]).toBe(labels[3]);
    expect(labels[4]).toBe(labels[0]);
    expect(labels[2]).not.toBe(labels[0]);
  });

  it("reports a single voice as one speaker", () => {
    const pieces = [piece(0, 2), piece(2, 4), piece(5, 7), piece(7, 9)];
    const labels = clusterTwoSpeakers(pieces, [
      like(VOICE_A, 0.2),
      like(VOICE_A, -0.2),
      like(VOICE_A, 0.1),
      like(VOICE_A, -0.1),
    ]);
    expect(labels).toEqual([0, 0, 0, 0]);
  });

  it("needs two pieces long enough to judge", () => {
    expect(clusterTwoSpeakers([], [])).toEqual([]);
    expect(
      clusterTwoSpeakers([piece(0, 2), piece(2, 2.5)], [VOICE_A, VOICE_B]),
    ).toEqual([0, 0]);
  });

  it("gives a piece too short to embed to its nearest neighbor", () => {
    const pieces = [
      piece(0, 2),
      piece(2.1, 2.4),
      piece(4, 6),
      piece(7.7, 8),
      piece(8.1, 10),
    ];
    const labels = clusterTwoSpeakers(pieces, [
      VOICE_A,
      [],
      VOICE_B,
      [],
      VOICE_A,
    ]);
    expect(labels[1]).toBe(labels[0]);
    expect(labels[3]).toBe(labels[4]);
    expect(labels[2]).not.toBe(labels[0]);
  });

  it("lets a short undecided piece follow its neighbor, across other unsure ones", () => {
    const pieces = [
      piece(0, 2),
      piece(2.1, 2.6),
      piece(2.7, 3),
      piece(5, 7),
      piece(8, 10),
    ];
    const labels = clusterTwoSpeakers(pieces, [
      VOICE_A,
      [0.55, 0.5, 0],
      [],
      VOICE_B,
      VOICE_B,
    ]);
    expect(labels[1]).toBe(labels[0]);
    expect(labels[2]).toBe(labels[0]);
  });

  it("keeps a short but clear interjection with its own speaker", () => {
    const pieces = [piece(0, 2), piece(2.1, 2.7), piece(2.8, 5), piece(6, 8)];
    const labels = clusterTwoSpeakers(pieces, [
      VOICE_A,
      VOICE_B,
      VOICE_A,
      VOICE_B,
    ]);
    expect(labels[1]).toBe(labels[3]);
    expect(labels[1]).not.toBe(labels[0]);
  });

  it("leaves unsure pieces alone when nothing around them is sure", () => {
    const pieces = [piece(0, 0.5), piece(1, 3), piece(4, 6)];
    // Both long pieces are one voice, so no split happens at all.
    expect(clusterTwoSpeakers(pieces, [[], VOICE_A, VOICE_A])).toEqual([
      0, 0, 0,
    ]);
  });
});

describe("buildTurns", () => {
  it("merges pieces into turns that tile the recording", () => {
    const pieces = [piece(1, 3), piece(3, 4), piece(5, 7), piece(9, 10)];
    const turns = buildTurns(pieces, [1, 1, 0, 1], 12 * SECOND);
    expect(turns).toEqual([
      { startSample: 0, endSample: 4.5 * SECOND, speaker: 0 },
      { startSample: 4.5 * SECOND, endSample: 8 * SECOND, speaker: 1 },
      { startSample: 8 * SECOND, endSample: 12 * SECOND, speaker: 0 },
    ]);
  });

  it("returns no turns without speech", () => {
    expect(buildTurns([], [], SECOND)).toEqual([]);
  });

  it("keeps speaker numbers across recordings", () => {
    const speakerIds = new Map<number, number>();
    const first = buildTurns([piece(0, 2)], [1], 2 * SECOND, speakerIds);
    const second = buildTurns(
      [piece(0, 2), piece(3, 5)],
      [0, 1],
      5 * SECOND,
      speakerIds,
    );
    expect(first.map((t) => t.speaker)).toEqual([0]);
    expect(second.map((t) => t.speaker)).toEqual([1, 0]);
  });
});
