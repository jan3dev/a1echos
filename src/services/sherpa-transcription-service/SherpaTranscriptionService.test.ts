import { createPcmLiveStream } from "react-native-sherpa-onnx/audio";
import { createStreamingSTT, createSTT } from "react-native-sherpa-onnx/stt";

import { ModelId } from "@/models";
import { writeJsonAtomic } from "@/utils";

import { sherpaTranscriptionService } from "./SherpaTranscriptionService";

jest.mock("@/utils", () => ({
  ...jest.requireActual("@/utils"),
  writeJsonAtomic: jest.fn(),
}));

jest.mock("../audio-session-service/AudioSessionService", () => ({
  audioSessionService: { ensureRecordingMode: jest.fn(async () => undefined) },
}));

const SAMPLE_RATE = 16000;
// 100ms mic callbacks, like the native stream delivers them.
const frame = (amplitude: number) =>
  new Float32Array(SAMPLE_RATE / 10).fill(amplitude);
const SPEECH = 0.1;
const SILENCE = 0;

let pushSamples: (samples: Float32Array) => void;
let now = 0;
const transcribeSamples = jest.fn();
const destroy = jest.fn(async () => undefined);

const feed = (amplitude: number, frames: number) => {
  for (let i = 0; i < frames; i++) {
    now += 100;
    pushSamples(frame(amplitude));
  }
};

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

const mockPcmStream = () =>
  (createPcmLiveStream as jest.Mock).mockImplementation(() => ({
    start: jest.fn(async () => undefined),
    stop: jest.fn(async () => undefined),
    onData: (cb: (s: Float32Array) => void) => {
      pushSamples = cb;
      return () => {};
    },
    onError: () => () => {},
  }));

describe("sherpaTranscriptionService realtime chunking", () => {
  beforeEach(async () => {
    jest.spyOn(Date, "now").mockImplementation(() => now);
    transcribeSamples.mockReset();
    transcribeSamples.mockResolvedValue({ text: "hello" });
    (createSTT as jest.Mock).mockResolvedValue({
      transcribeSamples,
      destroy,
    });
    mockPcmStream();
    await sherpaTranscriptionService.dispose();
    await sherpaTranscriptionService.initialize();
  });

  afterEach(async () => {
    jest.useRealTimers();
    await sherpaTranscriptionService.dispose();
    jest.restoreAllMocks();
  });

  const start = async (flushOnPause: boolean) => {
    const events: { text: string; boundary: string }[] = [];
    sherpaTranscriptionService.subscribeToChunk((e) => events.push(e));
    await sherpaTranscriptionService.startRealtimeTranscription({
      flushOnPause,
    });
    return events;
  };

  it("transcribes as soon as a phrase ends in realtime mode", async () => {
    const events = await start(true);
    feed(SPEECH, 10);
    feed(SILENCE, 5);
    await flushPromises();
    expect(transcribeSamples).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      expect.objectContaining({ text: "hello", boundary: "none" }),
    ]);
  });

  it("waits for the 5s cap without flushOnPause", async () => {
    await start(false);
    feed(SPEECH, 10);
    feed(SILENCE, 5);
    await flushPromises();
    expect(transcribeSamples).not.toHaveBeenCalled();
    feed(SPEECH, 35);
    await flushPromises();
    expect(transcribeSamples).toHaveBeenCalledTimes(1);
  });

  it("never sends silence to the engine", async () => {
    const events = await start(true);
    feed(SILENCE, 60);
    await sherpaTranscriptionService.stopRealtimeTranscription();
    expect(transcribeSamples).not.toHaveBeenCalled();
    expect(events).toEqual([
      expect.objectContaining({ text: "", boundary: "final" }),
    ]);
  });

  it("stopping mid-chunk still flushes the tail with a final boundary", async () => {
    let release!: () => void;
    transcribeSamples.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ text: "first" });
        }),
    );
    const events = await start(true);
    feed(SPEECH, 10);
    feed(SILENCE, 5);
    feed(SPEECH, 10);
    const stopped = sherpaTranscriptionService.stopRealtimeTranscription();
    release();
    await stopped;
    expect(events.map((e) => [e.text, e.boundary])).toEqual([
      ["first", "none"],
      ["hello", "final"],
    ]);
  });

  const blockNextTranscribe = (text: string) => {
    let release!: () => void;
    transcribeSamples.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ text });
        }),
    );
    return () => release();
  };

  it("drops a long pause that waited out a chunk while speech resumed", async () => {
    const release = blockNextTranscribe("first");
    const events = await start(false);
    jest.useFakeTimers({ doNotFake: ["Date", "setImmediate"] });
    feed(SPEECH, 50);
    feed(SILENCE, 30);
    jest.advanceTimersByTime(3000);
    feed(SPEECH, 5);
    release();
    await flushPromises();
    await sherpaTranscriptionService.stopRealtimeTranscription();
    expect(events.map((e) => [e.text, e.boundary])).toEqual([
      ["first", "none"],
      ["hello", "final"],
    ]);
  });

  it("dispose waits for the final flush before destroying the engine", async () => {
    const release = blockNextTranscribe("tail");
    const events = await start(false);
    feed(SPEECH, 10);
    const stopped = sherpaTranscriptionService.stopRealtimeTranscription();
    await flushPromises();
    destroy.mockClear();
    const disposed = sherpaTranscriptionService.dispose();
    await flushPromises();
    expect(destroy).not.toHaveBeenCalled();
    release();
    await Promise.all([stopped, disposed]);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(events).toContainEqual(
      expect.objectContaining({ text: "tail", boundary: "final" }),
    );
  });
});

describe("sherpaTranscriptionService streaming model", () => {
  const stream = {
    processAudioChunk: jest.fn(),
    acceptWaveform: jest.fn(async () => undefined),
    inputFinished: jest.fn(async () => undefined),
    isReady: jest.fn(async () => false),
    decode: jest.fn(async () => undefined),
    getResult: jest.fn(async () => ({ text: " tail" })),
    reset: jest.fn(async () => undefined),
    release: jest.fn(async () => undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (createStreamingSTT as jest.Mock).mockResolvedValue({
      createStream: jest.fn(async () => stream),
      destroy: jest.fn(async () => undefined),
    });
    mockPcmStream();
    await sherpaTranscriptionService.dispose();
    await sherpaTranscriptionService.initialize(ModelId.NEMOTRON_STREAMING_EN);
  });

  afterAll(() => sherpaTranscriptionService.dispose());

  it("loads through the streaming recognizer with raw input levels", () => {
    expect(createSTT).not.toHaveBeenCalled();
    expect(createStreamingSTT).toHaveBeenCalledWith(
      expect.objectContaining({
        modelType: "transducer",
        enableInputNormalization: false,
      }),
    );
  });

  it("emits changed partials, commits at endpoints and flushes on stop", async () => {
    const results = [
      { text: "hel", isEndpoint: false },
      { text: "hel", isEndpoint: false },
      { text: "hello", isEndpoint: true },
    ];
    stream.processAudioChunk.mockImplementation(async () => {
      const { text, isEndpoint } = results.shift()!;
      return { result: { text }, isEndpoint };
    });
    const events: { text: string; boundary: string; partial?: boolean }[] = [];
    sherpaTranscriptionService.subscribeToChunk((e) => events.push(e));
    await sherpaTranscriptionService.startRealtimeTranscription();

    for (let i = 0; i < 3; i++) {
      pushSamples(frame(SPEECH));
      await flushPromises();
    }
    await sherpaTranscriptionService.stopRealtimeTranscription();

    expect(
      events.map(({ text, boundary, partial }) => [text, boundary, !!partial]),
    ).toEqual([
      ["hel", "none", true],
      ["hello", "none", false],
      ["tail", "final", false],
    ]);
    expect(stream.inputFinished).toHaveBeenCalled();
    expect(stream.reset).toHaveBeenCalledTimes(2);
    expect(stream.release).toHaveBeenCalled();
  });
});

describe("sherpaTranscriptionService keyboard config", () => {
  it("writes the Whisper Tiny fallback and the app-engine flag for Qwen3", () => {
    sherpaTranscriptionService.refreshKeyboardConfig(ModelId.QWEN3_ASR, "zh");
    expect(writeJsonAtomic).toHaveBeenLastCalledWith(
      "keyboard-sherpa-model.json",
      expect.objectContaining({
        modelDir: expect.stringContaining(`models/${ModelId.WHISPER_TINY}`),
        modelType: "whisper",
        language: "zh",
        appEngine: true,
      }),
      expect.anything(),
    );
  });

  it("flags Nemotron for the app engine with the English Whisper Tiny fallback", () => {
    sherpaTranscriptionService.refreshKeyboardConfig(
      ModelId.NEMOTRON_STREAMING_EN,
      "en",
    );
    expect(writeJsonAtomic).toHaveBeenLastCalledWith(
      "keyboard-sherpa-model.json",
      expect.objectContaining({
        modelDir: expect.stringContaining(`models/${ModelId.WHISPER_TINY}`),
        modelType: "whisper",
        language: "en",
        appEngine: true,
      }),
      expect.anything(),
    );
  });

  it("doesn't flag keyboard-capable models for the app engine", () => {
    sherpaTranscriptionService.refreshKeyboardConfig(
      ModelId.WHISPER_TINY,
      "de",
    );
    expect(writeJsonAtomic).toHaveBeenLastCalledWith(
      "keyboard-sherpa-model.json",
      expect.not.objectContaining({ appEngine: true }),
      expect.anything(),
    );
  });
});
