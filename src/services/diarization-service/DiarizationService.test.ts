import { File } from "expo-file-system";

import { EchosDiarization } from "@modules/echos-diarization/src";

import {
  diarizationService,
  SpeakerIdentificationCancelledError,
} from "./DiarizationService";

const SECOND = 16000;
const HEADER = 44;

/** A WAV of [seconds, amplitude] runs; `odd` misaligns the PCM in its buffer. */
const wavBytes = (runs: [number, number][], odd = false): Uint8Array => {
  const samples = runs.flatMap(([seconds, amplitude]) =>
    new Array(Math.round(seconds * SECOND)).fill(amplitude),
  );
  const pad = odd ? 1 : 0;
  const buffer = new Uint8Array(pad + HEADER + samples.length * 2);
  const view = new DataView(buffer.buffer);
  samples.forEach((s, i) => view.setInt16(pad + HEADER + i * 2, s, true));
  return buffer.subarray(pad);
};

const mockFiles: Record<string, Uint8Array> = {};
const mockClose = jest.fn();

const SPEECH = 3000;
// Voice A talks for 1.8 s, then voice B, with pauses around them.
const INTERVIEW: [number, number][] = [
  [0.6, 0],
  [1.8, SPEECH],
  [0.6, 0],
  [1.8, SPEECH],
  [0.6, 0],
];

afterEach(() => jest.restoreAllMocks());

beforeEach(() => {
  for (const key of Object.keys(mockFiles)) delete mockFiles[key];
  (File as unknown as jest.Mock).mockImplementation((uri: string) => ({
    open: () => {
      const bytes = mockFiles[uri];
      const handle = {
        size: bytes.length,
        offset: 0,
        readBytesSync: (count: number) => {
          const chunk = bytes.subarray(handle.offset, handle.offset + count);
          handle.offset += chunk.length;
          return chunk;
        },
        close: mockClose,
      };
      return handle;
    },
  }));
  // The voice depends on where in the file the piece starts.
  (EchosDiarization!.embed as jest.Mock).mockImplementation(
    async (_uri: string, _model: string, ranges: number[]) =>
      ranges
        .filter((_, i) => i % 2 === 0)
        .map((start) => (start < 2.9 * SECOND ? [1, 0.1] : [0.1, 1])),
  );
});

describe("diarizationService.identifyTurns", () => {
  it("returns each file's turns with speakers numbered across files", async () => {
    mockFiles["a.wav"] = wavBytes(INTERVIEW);
    // Only the second voice (by position) speaks in the second file.
    mockFiles["b.wav"] = wavBytes(
      [
        [3.3, 0],
        [1.8, SPEECH],
        [0.6, 0],
      ],
      true,
    );
    const onProgress = jest.fn();

    const result = await diarizationService.identifyTurns(
      ["a.wav", "b.wav"],
      "model.onnx",
      { onProgress },
    );

    expect(result.speakerCount).toBe(2);
    expect(result.turns[0]).toEqual([
      { startSample: 0, endSample: 2.7 * SECOND, speaker: 0 },
      { startSample: 2.7 * SECOND, endSample: 5.4 * SECOND, speaker: 1 },
    ]);
    expect(result.turns[1]).toEqual([
      { startSample: 0, endSample: 5.7 * SECOND, speaker: 1 },
    ]);
    expect(EchosDiarization!.embed).toHaveBeenCalledWith(
      "a.wav",
      "model.onnx",
      [0.6 * SECOND, 2.4 * SECOND, 3 * SECOND, 4.8 * SECOND],
    );
    expect(onProgress).toHaveBeenLastCalledWith(1);
    expect(mockClose).toHaveBeenCalledTimes(2);
    expect(EchosDiarization!.release).toHaveBeenCalled();
  });

  it("returns no turns for a file without speech", async () => {
    mockFiles["quiet.wav"] = wavBytes([[2, 0]]);
    mockFiles["empty.wav"] = new Uint8Array(10);

    const result = await diarizationService.identifyTurns(
      ["quiet.wav", "empty.wav"],
      "model.onnx",
    );

    expect(result).toEqual({ turns: [[], []], speakerCount: 0 });
    expect(EchosDiarization!.embed).not.toHaveBeenCalled();
  });

  it("stops when cancelled and still frees the model", async () => {
    mockFiles["a.wav"] = wavBytes(INTERVIEW);
    let calls = 0;

    await expect(
      diarizationService.identifyTurns(["a.wav"], "model.onnx", {
        isCancelled: () => ++calls > 1,
      }),
    ).rejects.toBeInstanceOf(SpeakerIdentificationCancelledError);

    expect(EchosDiarization!.embed).not.toHaveBeenCalled();
    expect(EchosDiarization!.release).toHaveBeenCalled();
  });

  it("survives a failing release", async () => {
    mockFiles["quiet.wav"] = wavBytes([[2, 0]]);
    (EchosDiarization!.release as jest.Mock).mockRejectedValueOnce(
      new Error("gone"),
    );
    await expect(
      diarizationService.identifyTurns(["quiet.wav"], "model.onnx"),
    ).resolves.toEqual({ turns: [[]], speakerCount: 0 });
  });

  it("fails clearly when the native module is missing", async () => {
    jest.replaceProperty(
      jest.requireMock("@modules/echos-diarization/src"),
      "EchosDiarization",
      null,
    );
    await expect(
      diarizationService.identifyTurns(["a.wav"], "model.onnx"),
    ).rejects.toThrow("Speaker module unavailable");
  });
});
