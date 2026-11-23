import { renderHook } from "@testing-library/react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

import { TranscriptionState, type Transcription } from "@/models";
import {
  audioProtectionService,
  diarizationService,
  modelDownloadService,
  SpeakerIdentificationCancelledError,
} from "@/services";

import {
  labelSpeakers,
  speakerName,
  useCancelIdentifySpeakers,
  useIdentifySpeakers,
  useSpeakerJob,
  useSpeakerStore,
} from "./speakerStore";

jest.mock("@/utils", () => ({
  FeatureFlag: { transcription: "transcription" },
  logError: jest.fn(),
}));

jest.mock("@/localization", () => ({
  i18n: {
    t: (key: string, options: { number: number }) => `${key}:${options.number}`,
  },
}));

jest.mock("expo-keep-awake", () => ({
  activateKeepAwakeAsync: jest.fn(async () => {}),
  deactivateKeepAwake: jest.fn(async () => {}),
}));

jest.mock("@/services", () => {
  class MockCancelled extends Error {}
  return {
    audioProtectionService: {
      audioExists: jest.fn(),
      openPlaintextAudio: jest.fn(),
    },
    diarizationService: { identifyTurns: jest.fn() },
    modelDownloadService: { getModelPath: jest.fn() },
    SpeakerIdentificationCancelledError: MockCancelled,
  };
});

let mockSessions: Record<string, { speakerNames?: string[] }> = {};
jest.mock("../session-store/sessionStore", () => ({
  useSessionStore: {
    getState: () => ({
      findSessionById: (id: string) => mockSessions[id] ?? null,
    }),
  },
}));

let mockDownloaded = true;
jest.mock("../model-download-store/modelDownloadStore", () => ({
  useModelDownloadStore: {
    getState: () => ({ isDownloaded: () => mockDownloaded }),
  },
}));

const mockUpdateTranscription = jest.fn(async () => {});
const mockSplit = jest.fn(async () => {});
let mockCanTransition = true;
const mockTransitionTo = jest.fn((state: string) => {
  if (!mockCanTransition) return false;
  mockTranscriptionState.state = state;
  return true;
});
let mockTranscriptionState: { state: string; transcriptions: Transcription[] };
jest.mock("../transcription-store/transcriptionStore", () => ({
  useTranscriptionStore: {
    getState: () => ({
      ...mockTranscriptionState,
      sessionTranscriptions: (id: string) =>
        mockTranscriptionState.transcriptions.filter((t) => t.sessionId === id),
      transitionTo: mockTransitionTo,
      updateTranscription: mockUpdateTranscription,
      splitTranscriptionBySpeaker: mockSplit,
    }),
  },
}));

const item = (
  id: string,
  extra: Partial<Transcription> = {},
): Transcription => ({
  id,
  sessionId: "s1",
  text: `text ${id}`,
  timestamp: new Date(Number(id.slice(1)) * 1000),
  audioPath: `${id}.wav`,
  ...extra,
});

const turn = (start: number, end: number, speaker: number) => ({
  startSample: start,
  endSample: end,
  speaker,
});

const mockRelease = jest.fn(async () => {});
const identify = () => useSpeakerStore.getState().identifySpeakers("s1");

beforeEach(() => {
  mockSessions = { s1: {} };
  mockDownloaded = true;
  mockCanTransition = true;
  mockTranscriptionState = {
    state: TranscriptionState.READY,
    transcriptions: [item("t1"), item("t2")],
  };
  useSpeakerStore.setState({ job: null });
  (modelDownloadService.getModelPath as jest.Mock).mockReturnValue(
    "/models/spk",
  );
  (audioProtectionService.audioExists as jest.Mock).mockImplementation(
    (path: string) => path !== "",
  );
  (audioProtectionService.openPlaintextAudio as jest.Mock).mockImplementation(
    async (path: string) => ({ path: `/plain/${path}`, release: mockRelease }),
  );
  (diarizationService.identifyTurns as jest.Mock).mockResolvedValue({
    turns: [[turn(0, 100, 0)], [turn(0, 50, 1), turn(50, 90, 0)]],
    speakerCount: 2,
  });
});

describe("speakerStore.identifySpeakers", () => {
  it("labels single-speaker items and splits the ones with several turns", async () => {
    await expect(identify()).resolves.toBe("done");

    expect(diarizationService.identifyTurns).toHaveBeenCalledWith(
      ["/plain/t1.wav", "/plain/t2.wav"],
      "/models/spk/nemo_en_titanet_small.onnx",
      expect.any(Object),
    );
    expect(mockUpdateTranscription).toHaveBeenCalledWith({
      ...item("t1"),
      speaker: 0,
    });
    expect(mockSplit).toHaveBeenCalledWith(
      item("t2"),
      [turn(0, 50, 1), turn(50, 90, 0)],
      "/plain/t2.wav",
    );
    expect(mockRelease).toHaveBeenCalledTimes(2);
    expect(activateKeepAwakeAsync).toHaveBeenCalled();
    expect(deactivateKeepAwake).toHaveBeenCalled();
    expect(mockTransitionTo).toHaveBeenLastCalledWith(TranscriptionState.READY);
    expect(useSpeakerStore.getState().job).toBeNull();
  });

  it("reports progress through both phases", async () => {
    const seen: number[] = [];
    const unsubscribe = useSpeakerStore.subscribe((s) => {
      if (s.job) seen.push(s.job.progress);
    });
    (diarizationService.identifyTurns as jest.Mock).mockImplementation(
      async (_uris, _model, { onProgress }) => {
        onProgress(0.5);
        return { turns: [[turn(0, 100, 0)], []], speakerCount: 2 };
      },
    );

    await identify();
    unsubscribe();

    expect(seen).toEqual([0, 0.2, 0.7, 1]);
    expect(mockSplit).not.toHaveBeenCalled();
  });

  it("ignores summaries and items without audio", async () => {
    mockTranscriptionState.transcriptions = [
      item("t1", { kind: "summary" }),
      item("t2", { audioPath: "" }),
    ];
    await expect(identify()).resolves.toBe("no-audio");
    expect(mockTransitionTo).not.toHaveBeenCalled();
  });

  it("needs the speaker model", async () => {
    mockDownloaded = false;
    await expect(identify()).resolves.toBe("no-model");

    mockDownloaded = true;
    (modelDownloadService.getModelPath as jest.Mock).mockReturnValue(null);
    await expect(identify()).resolves.toBe("no-model");
  });

  it("refuses while recording, transcribing or already running", async () => {
    mockTranscriptionState.state = TranscriptionState.RECORDING;
    await expect(identify()).resolves.toBe("busy");

    mockTranscriptionState.state = TranscriptionState.READY;
    mockCanTransition = false;
    await expect(identify()).resolves.toBe("busy");

    useSpeakerStore.setState({ job: { sessionId: "s2", progress: 0 } });
    await expect(identify()).resolves.toBe("busy");
    expect(diarizationService.identifyTurns).not.toHaveBeenCalled();
  });

  it("changes nothing when only one voice is found", async () => {
    (diarizationService.identifyTurns as jest.Mock).mockResolvedValue({
      turns: [[turn(0, 100, 0)], [turn(0, 90, 0)]],
      speakerCount: 1,
    });
    await expect(identify()).resolves.toBe("one-speaker");
    expect(mockUpdateTranscription).not.toHaveBeenCalled();
  });

  it("skips items edited or deleted during the analysis", async () => {
    (diarizationService.identifyTurns as jest.Mock).mockImplementation(
      async () => {
        mockTranscriptionState.transcriptions = [
          item("t2", { audioPath: "replaced.wav" }),
        ];
        return {
          turns: [[turn(0, 100, 0)], [turn(0, 90, 1)]],
          speakerCount: 2,
        };
      },
    );
    await expect(identify()).resolves.toBe("done");
    expect(mockUpdateTranscription).not.toHaveBeenCalled();
    expect(mockSplit).not.toHaveBeenCalled();
  });

  it("stops between items when cancelled", async () => {
    mockUpdateTranscription.mockImplementationOnce(async () => {
      useSpeakerStore.getState().cancelIdentifySpeakers();
    });
    await expect(identify()).resolves.toBe("stopped");
    expect(mockSplit).not.toHaveBeenCalled();
    expect(mockTransitionTo).toHaveBeenLastCalledWith(TranscriptionState.READY);
  });

  it("stops during the analysis when cancelled", async () => {
    (diarizationService.identifyTurns as jest.Mock).mockImplementation(
      async (_uris, _model, { isCancelled }) => {
        expect(isCancelled()).toBe(false);
        useSpeakerStore.getState().cancelIdentifySpeakers();
        expect(isCancelled()).toBe(true);
        throw new SpeakerIdentificationCancelledError();
      },
    );
    await expect(identify()).resolves.toBe("stopped");
  });

  it("rethrows failures after cleaning up", async () => {
    (diarizationService.identifyTurns as jest.Mock).mockRejectedValue(
      new Error("model broke"),
    );
    (activateKeepAwakeAsync as jest.Mock).mockRejectedValueOnce(new Error());
    (deactivateKeepAwake as jest.Mock).mockRejectedValueOnce(new Error());

    await expect(identify()).rejects.toThrow("model broke");

    expect(mockRelease).toHaveBeenCalledTimes(2);
    expect(mockTransitionTo).toHaveBeenLastCalledWith(TranscriptionState.READY);
    expect(useSpeakerStore.getState().job).toBeNull();
  });
});

describe("speaker names", () => {
  it("falls back to a numbered default", () => {
    expect(speakerName(null, 1)).toBe("speakerDefaultName:2");
    expect(speakerName({ speakerNames: ["", "  "] } as never, 1)).toBe(
      "speakerDefaultName:2",
    );
    expect(speakerName({ speakerNames: ["Ana"] } as never, 0)).toBe("Ana");
  });

  it("prefixes identified turns with who is talking", () => {
    mockSessions = { s1: { speakerNames: ["Ana"] } };
    const plain = item("t1");
    const labeled = labelSpeakers([
      plain,
      item("t2", { speaker: 0 }),
      item("t3", { speaker: 1 }),
    ]);
    expect(labeled[0]).toBe(plain);
    expect(labeled.map((t) => t.text)).toEqual([
      "text t1",
      "Ana: text t2",
      "speakerDefaultName:2: text t3",
    ]);
  });
});

describe("speaker hooks", () => {
  it("expose the store", () => {
    useSpeakerStore.setState({ job: { sessionId: "s1", progress: 0.5 } });
    expect(renderHook(() => useSpeakerJob()).result.current).toEqual({
      sessionId: "s1",
      progress: 0.5,
    });
    expect(renderHook(() => useIdentifySpeakers()).result.current).toBe(
      useSpeakerStore.getState().identifySpeakers,
    );
    expect(renderHook(() => useCancelIdentifySpeakers()).result.current).toBe(
      useSpeakerStore.getState().cancelIdentifySpeakers,
    );
  });
});
