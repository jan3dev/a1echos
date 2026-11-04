import { renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

import { TranscriptionState, type Transcription } from "@/models";
import {
  databaseService,
  llmService,
  summarize,
  SummaryCancelledError,
} from "@/services";

import {
  blocksSummary,
  summarizableText,
  useCancelSummary,
  useIsSummaryBlocked,
  useSummarizeSession,
  useSummaryJob,
  useSummarySessionId,
  useSummaryStore,
} from "./summaryStore";

jest.mock("@/utils", () => ({
  FeatureFlag: { store: "store" },
  logError: jest.fn(),
}));

jest.mock("expo-keep-awake", () => ({
  activateKeepAwakeAsync: jest.fn(async () => {}),
  deactivateKeepAwake: jest.fn(async () => {}),
}));

jest.mock("@/services", () => {
  class MockCancelled extends Error {}
  return {
    databaseService: { upsertTranscription: jest.fn() },
    llmService: {
      inputBudget: jest.fn(() => 6656),
      finalInputBudget: jest.fn(() => 4608),
      finalOutputTokens: jest.fn((_id: string, t: number) => 7680 - t),
      countTokens: jest.fn(async () => 10),
      run: jest.fn(async () => ({ text: "- partial" })),
      stop: jest.fn(async () => {}),
      release: jest.fn(async () => {}),
    },
    summarize: jest.fn(),
    SummaryCancelledError: MockCancelled,
  };
});

const mockSession = { id: "s1", isIncognito: false };
let mockSessions: Record<string, typeof mockSession> = {};
const mockUpdateModified = jest.fn(async () => {});
jest.mock("../session-store/sessionStore", () => ({
  useSessionStore: {
    getState: () => ({
      findSessionById: (id: string) => mockSessions[id] ?? null,
      updateSessionModifiedTimestamp: mockUpdateModified,
    }),
  },
}));

let mockLlmId: string | null = "qwen35_2b";
jest.mock("../settings-store/settingsStore", () => ({
  useSettingsStore: { getState: () => ({ selectedLlmId: mockLlmId }) },
}));

let mockDownloaded = true;
jest.mock("../model-download-store/modelDownloadStore", () => ({
  useModelDownloadStore: {
    getState: () => ({ isDownloaded: () => mockDownloaded }),
  },
}));

const mockAddTranscription = jest.fn();
let mockTranscriptionState = { state: "ready", transcriptions: [] as any[] };
let mockTranscriptionListener: ((s: { state: string }) => void) | null = null;
jest.mock("../transcription-store/transcriptionStore", () => {
  const { TranscriptionState: S } = jest.requireActual("@/models");
  return {
    AUDIO_BUSY_STATES: new Set([
      S.RECORDING_STARTING,
      S.RECORDING,
      S.TRANSCRIBING,
      S.STREAMING,
      S.LOADING,
    ]),
    useTranscriptionStore: Object.assign(
      (select: (s: typeof mockTranscriptionState) => unknown) =>
        select(mockTranscriptionState),
      {
        getState: () => ({
          ...mockTranscriptionState,
          addTranscription: mockAddTranscription,
          sessionTranscriptions: (id: string) =>
            mockTranscriptionState.transcriptions.filter(
              (t) => t.sessionId === id,
            ),
        }),
        subscribe: (listener: (s: { state: string }) => void) => {
          mockTranscriptionListener = listener;
          return () => (mockTranscriptionListener = null);
        },
      },
    ),
  };
});

const transcript = (text: string, kind?: "summary"): Transcription => ({
  id: text,
  sessionId: "s1",
  text,
  timestamp: new Date(0),
  audioPath: "",
  ...(kind && { kind }),
});

let appStateListener: ((state: string) => void) | null = null;
const removeAppState = jest.fn();

/** Holds summarize() open until the test resolves or inspects it. */
const pendingSummary = () => {
  let resolve!: (text: string) => void;
  let deps: any;
  (summarize as jest.Mock).mockImplementation(
    (_text, d) =>
      new Promise((r, reject) => {
        deps = d;
        resolve = r;
        // Mirror the real summarize: a cancelled run rejects.
        d.cancelProbe = () => {
          if (d.isCancelled()) reject(new SummaryCancelledError());
        };
      }),
  );
  return {
    resolve: (text: string) => resolve(text),
    deps: () => deps,
  };
};

describe("summaryStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSummaryStore.setState({ job: null });
    mockSessions = { s1: { ...mockSession } };
    mockLlmId = "qwen35_2b";
    mockDownloaded = true;
    mockTranscriptionState = {
      state: "ready",
      transcriptions: [
        transcript("We ship on Wednesday."),
        transcript("- Old summary", "summary"),
        transcript("   "),
        { ...transcript("Other session"), sessionId: "s2" },
      ],
    };
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_type, listener: any) => {
        appStateListener = listener;
        return { remove: removeAppState } as any;
      });
    (summarize as jest.Mock).mockResolvedValue("- Ship Wednesday");
  });

  const start = () => useSummaryStore.getState().summarizeSession("s1");

  it("reads transcripts only, never earlier summaries or blanks", () => {
    expect(
      summarizableText([
        transcript(" a "),
        transcript("- s", "summary"),
        transcript(""),
        transcript("b"),
      ]),
    ).toBe("a\n\nb");
  });

  it("yields to recording and transcription but not to engine loading", () => {
    expect(blocksSummary(TranscriptionState.RECORDING)).toBe(true);
    expect(blocksSummary(TranscriptionState.TRANSCRIBING)).toBe(true);
    expect(blocksSummary(TranscriptionState.LOADING)).toBe(false);
    expect(blocksSummary(TranscriptionState.READY)).toBe(false);
  });

  it("saves the summary as a new item, then frees the model", async () => {
    await expect(start()).resolves.toBe("done");

    expect((summarize as jest.Mock).mock.calls[0][0]).toBe(
      "We ship on Wednesday.",
    );
    const saved = {
      id: expect.any(String),
      sessionId: "s1",
      text: "- Ship Wednesday",
      timestamp: expect.any(Date),
      audioPath: "",
      kind: "summary",
    };
    expect(databaseService.upsertTranscription).toHaveBeenCalledWith(saved);
    expect(mockAddTranscription).toHaveBeenCalledWith(saved);
    expect(mockUpdateModified).toHaveBeenCalledWith("s1");
    expect(llmService.release).toHaveBeenCalled();
    expect(removeAppState).toHaveBeenCalled();
    expect(mockTranscriptionListener).toBeNull();
    expect(useSummaryStore.getState().job).toBeNull();
  });

  it("keeps an incognito summary in memory only", async () => {
    mockSessions.s1.isIncognito = true;
    await expect(start()).resolves.toBe("done");
    expect(databaseService.upsertTranscription).not.toHaveBeenCalled();
    expect(mockUpdateModified).not.toHaveBeenCalled();
    expect(mockAddTranscription).toHaveBeenCalled();
  });

  it("still saves when the session timestamp can't be updated", async () => {
    mockUpdateModified.mockRejectedValueOnce(new Error("db"));
    await expect(start()).resolves.toBe("done");
  });

  it.each([
    ["no model is selected", () => (mockLlmId = null), "no-model"],
    ["the model was deleted", () => (mockDownloaded = false), "no-model"],
    [
      "there is nothing but summaries",
      () => (mockTranscriptionState.transcriptions = []),
      "empty",
    ],
    [
      "a recording is running",
      () => (mockTranscriptionState.state = TranscriptionState.RECORDING),
      "cancelled",
    ],
  ])("doesn't start when %s", async (_why, arrange, outcome) => {
    arrange();
    await expect(start()).resolves.toBe(outcome);
    expect(summarize).not.toHaveBeenCalled();
  });

  it("drops the summary when the session was deleted meanwhile", async () => {
    const pending = pendingSummary();
    const result = start();
    expect(pending.deps().isCancelled()).toBe(false);
    delete mockSessions.s1;
    expect(pending.deps().isCancelled()).toBe(true);
    pending.resolve("- late");
    await expect(result).resolves.toBe("cancelled");
    expect(mockAddTranscription).not.toHaveBeenCalled();
  });

  it("exposes progress and streamed text while running", async () => {
    const pending = pendingSummary();
    const result = start();
    expect(useSummaryStore.getState().job).toEqual(
      expect.objectContaining({ sessionId: "s1", text: "", parts: 0 }),
    );
    pending.deps().onProgress(2, 3);
    pending.deps().onText("- Ship");
    expect(useSummaryStore.getState().job).toEqual(
      expect.objectContaining({ part: 2, parts: 3, text: "- Ship" }),
    );
    pending.resolve("- Ship");
    await result;
  });

  it("wires the model through the summarizer's dependencies", async () => {
    const pending = pendingSummary();
    const result = start();
    const d = pending.deps();
    expect(d.budget).toBe(6656);
    expect(d.finalBudget).toBe(4608);
    expect(d.finalOutputTokens(1000)).toBe(6680);
    await d.countTokens("x");
    expect(llmService.countTokens).toHaveBeenCalledWith("qwen35_2b", "x");
    const options = { onText: jest.fn(), maxOutputTokens: 4096 };
    await expect(d.complete("merge", "in", options)).resolves.toBe("- partial");
    expect(llmService.run).toHaveBeenCalledWith("qwen35_2b", "merge", "in", {
      ...options,
      isCancelled: d.isCancelled,
    });
    pending.resolve("- done");
    await result;
  });

  it.each([
    [
      "the user cancels",
      () => useSummaryStore.getState().cancelSummary(),
      "stopped",
    ],
    [
      "the app goes to the background",
      () => appStateListener!("background"),
      "cancelled",
    ],
    [
      "a recording starts",
      () => mockTranscriptionListener!({ state: TranscriptionState.RECORDING }),
      "cancelled",
    ],
  ])("stops when %s", async (_why, trigger, outcome) => {
    const pending = pendingSummary();
    const result = start();
    trigger();
    expect(llmService.stop).toHaveBeenCalledTimes(1);
    // A second trigger doesn't stop twice.
    useSummaryStore.getState().cancelSummary();
    expect(llmService.stop).toHaveBeenCalledTimes(1);
    pending.deps().cancelProbe();
    await expect(result).resolves.toBe(outcome);
    expect(mockAddTranscription).not.toHaveBeenCalled();
  });

  it("keeps the screen awake while summarizing", async () => {
    const pending = pendingSummary();
    const result = start();
    expect(activateKeepAwakeAsync).toHaveBeenCalledWith("summary");
    expect(deactivateKeepAwake).not.toHaveBeenCalled();
    pending.resolve("- ok");
    await result;
    expect(deactivateKeepAwake).toHaveBeenCalledWith("summary");
  });

  it("survives keep-awake and stop failures", async () => {
    (activateKeepAwakeAsync as jest.Mock).mockRejectedValueOnce(new Error("a"));
    (deactivateKeepAwake as jest.Mock).mockRejectedValueOnce(new Error("d"));
    (llmService.stop as jest.Mock).mockRejectedValueOnce(new Error("s"));
    const pending = pendingSummary();
    const result = start();
    useSummaryStore.getState().cancelSummary();
    pending.deps().cancelProbe();
    await expect(result).resolves.toBe("stopped");
  });

  it("exposes the job, its session, and whether a recording blocks it", async () => {
    const hooks = () => {
      const { result, unmount } = renderHook(() => ({
        job: useSummaryJob(),
        sessionId: useSummarySessionId(),
        blocked: useIsSummaryBlocked(),
        summarize: useSummarizeSession(),
        cancel: useCancelSummary(),
      }));
      unmount();
      return result.current;
    };
    expect(hooks()).toEqual({
      job: null,
      sessionId: null,
      blocked: false,
      summarize: useSummaryStore.getState().summarizeSession,
      cancel: useSummaryStore.getState().cancelSummary,
    });

    const pending = pendingSummary();
    const result = start();
    mockTranscriptionState.state = TranscriptionState.RECORDING;
    expect(hooks()).toEqual(
      expect.objectContaining({ sessionId: "s1", blocked: true }),
    );
    pending.resolve("- ok");
    await result;
  });

  it("ignores app-state changes that aren't backgrounding", async () => {
    const pending = pendingSummary();
    const result = start();
    appStateListener!("inactive");
    mockTranscriptionListener!({ state: TranscriptionState.LOADING });
    expect(llmService.stop).not.toHaveBeenCalled();
    pending.resolve("- ok");
    await expect(result).resolves.toBe("done");
  });

  it("does nothing when cancelling with no summary running", () => {
    useSummaryStore.getState().cancelSummary();
    expect(llmService.stop).not.toHaveBeenCalled();
  });

  it("refuses a second summary while one runs", async () => {
    const pending = pendingSummary();
    const result = start();
    await expect(start()).rejects.toThrow("already running");
    pending.resolve("- ok");
    await result;
  });

  it("fails on an empty summary or a model error, and cleans up", async () => {
    (summarize as jest.Mock).mockResolvedValueOnce("");
    await expect(start()).rejects.toThrow("empty summary");

    (summarize as jest.Mock).mockRejectedValueOnce(new Error("oom"));
    (llmService.release as jest.Mock).mockRejectedValueOnce(new Error("x"));
    await expect(start()).rejects.toThrow("oom");
    expect(useSummaryStore.getState().job).toBeNull();
  });
});
