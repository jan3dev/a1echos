import * as Crypto from "expo-crypto";
import { renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";

import {
  ModelType,
  Transcription,
  TranscriptionMode,
  TranscriptionState,
} from "@/models";
import {
  backgroundRecordingService,
  storageService,
  sherpaTranscriptionService,
} from "@/services";

import { useSessionStore } from "../session-store/sessionStore";
import { useSettingsStore } from "../settings-store/settingsStore";
import {
  useTranscriptionStore,
  useTranscriptionState,
  useSessionTranscriptions,
  useIsRecording,
  useAudioLevel,
  useStartRecording,
  useStopRecordingAndSave,
  useDeleteTranscriptions,
  useLivePreview,
  initializeTranscriptionStore,
} from "./transcriptionStore";

jest.mock("@/services", () => ({
  storageService: {
    getTranscriptions: jest.fn(async () => []),
    saveTranscription: jest.fn(async () => undefined),
    deleteTranscription: jest.fn(async () => undefined),
    deleteTranscriptionsForSession: jest.fn(async () => undefined),
    clearTranscriptions: jest.fn(async () => undefined),
    saveAudioFile: jest.fn(
      async (_src: string, name: string) => `/audio/${name}`,
    ),
    // Also needed by sessionStore (cross-store calls from updateSessionModifiedTimestamp)
    getSessions: jest.fn(async () => []),
    saveSessions: jest.fn(async () => undefined),
    getActiveSessionId: jest.fn(async () => null),
    saveActiveSessionId: jest.fn(async () => undefined),
    clearActiveSessionId: jest.fn(async () => undefined),
  },
  sherpaTranscriptionService: {
    initialize: jest.fn(async () => true),
    transcribeFile: jest.fn(async () => "Transcribed text."),
    startRealtimeTranscription: jest.fn(async () => true),
    stopRealtimeTranscription: jest.fn(async () => null),
    subscribeToChunk: jest.fn(() => jest.fn()),
    subscribeToAudioLevel: jest.fn(() => jest.fn()),
    initializationStatus: "ready",
    dispose: jest.fn(async () => undefined),
  },
  backgroundRecordingService: {
    startBackgroundService: jest.fn(async () => true),
    stopBackgroundService: jest.fn(async () => undefined),
  },
}));

jest.mock("@/utils", () => ({
  FeatureFlag: {
    store: "STORE",
    recording: "RECORDING",
    model: "MODEL",
    service: "SERVICE",
  },
  logError: jest.fn(),
  logWarn: jest.fn(),
  formatTranscriptionText: jest.fn((text: string) => text),
}));

const testSession = {
  id: "session-1",
  name: "S1",
  timestamp: new Date("2024-01-01"),
  lastModified: new Date("2024-01-01"),
  isIncognito: false,
};

const makeTx = (
  overrides: Partial<Transcription> & { id: string },
): Transcription => ({
  sessionId: "session-1",
  text: "Hello world",
  timestamp: new Date("2024-01-01"),
  audioPath: "/audio/test.wav",
  ...overrides,
});

const getInitialState = () => ({
  state: TranscriptionState.LOADING,
  errorMessage: null,
  currentStreamingText: "",
  livePreview: null,
  loadingPreview: null,
  recordingSessionId: null,
  audioLevel: 0,
  transcriptions: [],
  isLoaded: false,
  isInitialized: false,
  initError: null,
  isEngineReady: false,
  isEngineInitializing: false,
  isOperationLocked: false,
  activeOperations: new Set<string>(),
  lastOperationTime: null,
  chunkUnsubscribe: null,
  realtimeAudioLevelUnsubscribe: null,
  smartSplit: {
    currentItemId: null,
    currentItemText: "",
    currentItemStartMs: 0,
    createdTranscriptions: [],
    deferPersist: false,
  },
});

const originalPlatformOS = Platform.OS;

type ChunkBoundary = "none" | "long" | "final";
interface ChunkEvent {
  text: string;
  boundary: ChunkBoundary;
}

let capturedChunkCallback: ((event: ChunkEvent) => void) | null = null;
let capturedAudioLevelCallback: ((level: number) => void) | null = null;

const emitChunk = (event: ChunkEvent) => {
  if (!capturedChunkCallback) {
    throw new Error("Chunk callback not captured — did startRecording run?");
  }
  capturedChunkCallback(event);
};

describe("transcriptionStore", () => {
  beforeEach(() => {
    useTranscriptionStore.setState(getInitialState());
    capturedChunkCallback = null;
    // Reset cross-store state
    useSessionStore.setState({
      sessions: [],
      activeSessionId: "session-1",
      incognitoSession: null,
      isLoaded: true,
      needsSort: false,
    });
    useSettingsStore.setState({
      selectedModelType: ModelType.WHISPER_FILE,
      selectedTranscriptionMode: TranscriptionMode.FILE,
      selectedLanguage: { code: "en", name: "English" },
      smartSplitEnabled: true,
    });
    (Crypto.randomUUID as jest.Mock).mockReturnValue("transcription-uuid");

    (
      sherpaTranscriptionService.subscribeToChunk as jest.Mock
    ).mockImplementation((cb: (event: ChunkEvent) => void) => {
      capturedChunkCallback = cb;
      return jest.fn();
    });

    capturedAudioLevelCallback = null;
    (
      sherpaTranscriptionService.subscribeToAudioLevel as jest.Mock
    ).mockImplementation((cb: (level: number) => void) => {
      capturedAudioLevelCallback = cb;
      return jest.fn();
    });

    // Default: stop flushes a `final` boundary so the store finalizes the
    // tail. Returns null — tests that need a saved WAV override per-case.
    (
      sherpaTranscriptionService.stopRealtimeTranscription as jest.Mock
    ).mockImplementation(async () => {
      capturedChunkCallback?.({
        text: "Realtime text.",
        boundary: "final",
      });
      return null;
    });
  });

  afterEach(() => {
    Platform.OS = originalPlatformOS;
  });

  describe("initial state", () => {
    it("has correct defaults", () => {
      const state = useTranscriptionStore.getState();
      expect(state.state).toBe(TranscriptionState.LOADING);
      expect(state.errorMessage).toBeNull();
      expect(state.transcriptions).toEqual([]);
      expect(state.isInitialized).toBe(false);
      expect(state.isEngineReady).toBe(false);
      expect(state.isEngineInitializing).toBe(false);
      expect(state.isOperationLocked).toBe(false);
    });
  });

  describe("setEngineInitializing", () => {
    it("flips the flag and is a no-op when already at the requested value", () => {
      const set = useTranscriptionStore.getState().setEngineInitializing;
      set(true);
      expect(useTranscriptionStore.getState().isEngineInitializing).toBe(true);
      // Calling with the same value should not trigger another set, but
      // observably the value stays the same.
      set(true);
      expect(useTranscriptionStore.getState().isEngineInitializing).toBe(true);
      set(false);
      expect(useTranscriptionStore.getState().isEngineInitializing).toBe(false);
    });
  });

  describe("state machine (transitionTo)", () => {
    it("LOADING -> READY is valid", () => {
      expect(
        useTranscriptionStore.getState().transitionTo(TranscriptionState.READY),
      ).toBe(true);
      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.READY,
      );
    });

    it("LOADING -> ERROR is valid and sets error message", () => {
      expect(
        useTranscriptionStore
          .getState()
          .transitionTo(TranscriptionState.ERROR, "Init failed"),
      ).toBe(true);
      expect(useTranscriptionStore.getState().errorMessage).toBe("Init failed");
    });

    it('ERROR defaults to "Unknown error occurred" when no message', () => {
      useTranscriptionStore.getState().transitionTo(TranscriptionState.ERROR);
      expect(useTranscriptionStore.getState().errorMessage).toBe(
        "Unknown error occurred",
      );
    });

    it("READY -> RECORDING_STARTING -> RECORDING is valid", () => {
      useTranscriptionStore.getState().transitionTo(TranscriptionState.READY);
      expect(
        useTranscriptionStore
          .getState()
          .transitionTo(TranscriptionState.RECORDING_STARTING),
      ).toBe(true);
      expect(
        useTranscriptionStore
          .getState()
          .transitionTo(TranscriptionState.RECORDING),
      ).toBe(true);
    });

    it("READY -> RECORDING (skipping RECORDING_STARTING) is not valid", () => {
      useTranscriptionStore.getState().transitionTo(TranscriptionState.READY);
      expect(
        useTranscriptionStore
          .getState()
          .transitionTo(TranscriptionState.RECORDING),
      ).toBe(false);
    });

    it("RECORDING_STARTING -> READY is valid (graceful cancel)", () => {
      useTranscriptionStore.getState().transitionTo(TranscriptionState.READY);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.RECORDING_STARTING);
      expect(
        useTranscriptionStore.getState().transitionTo(TranscriptionState.READY),
      ).toBe(true);
    });

    it("RECORDING_STARTING -> ERROR is valid", () => {
      useTranscriptionStore.getState().transitionTo(TranscriptionState.READY);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.RECORDING_STARTING);
      expect(
        useTranscriptionStore
          .getState()
          .transitionTo(TranscriptionState.ERROR, "init failed"),
      ).toBe(true);
    });

    it("RECORDING -> TRANSCRIBING is valid", () => {
      useTranscriptionStore.getState().transitionTo(TranscriptionState.READY);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.RECORDING_STARTING);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.RECORDING);
      expect(
        useTranscriptionStore
          .getState()
          .transitionTo(TranscriptionState.TRANSCRIBING),
      ).toBe(true);
    });

    it("RECORDING -> STREAMING is valid", () => {
      useTranscriptionStore.getState().transitionTo(TranscriptionState.READY);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.RECORDING_STARTING);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.RECORDING);
      expect(
        useTranscriptionStore
          .getState()
          .transitionTo(TranscriptionState.STREAMING),
      ).toBe(true);
    });

    it("STREAMING -> TRANSCRIBING is valid", () => {
      useTranscriptionStore.getState().transitionTo(TranscriptionState.READY);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.RECORDING_STARTING);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.RECORDING);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.STREAMING);
      expect(
        useTranscriptionStore
          .getState()
          .transitionTo(TranscriptionState.TRANSCRIBING),
      ).toBe(true);
    });

    it("ERROR -> READY is valid", () => {
      useTranscriptionStore.getState().transitionTo(TranscriptionState.ERROR);
      expect(
        useTranscriptionStore.getState().transitionTo(TranscriptionState.READY),
      ).toBe(true);
    });

    it("invalid transition returns false", () => {
      // LOADING -> RECORDING is not valid
      expect(
        useTranscriptionStore
          .getState()
          .transitionTo(TranscriptionState.RECORDING),
      ).toBe(false);
      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.LOADING,
      );
    });

    it("non-ERROR transition clears errorMessage", () => {
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.ERROR, "Some error");
      useTranscriptionStore.getState().transitionTo(TranscriptionState.READY);
      expect(useTranscriptionStore.getState().errorMessage).toBeNull();
    });
  });

  describe("computed state helpers", () => {
    it("isLoading returns true in LOADING state", () => {
      expect(useTranscriptionStore.getState().isLoading()).toBe(true);
    });

    it("isRecording returns true in RECORDING state", () => {
      useTranscriptionStore.setState({ state: TranscriptionState.RECORDING });
      expect(useTranscriptionStore.getState().isRecording()).toBe(true);
    });

    it("isTranscribing returns true in TRANSCRIBING state", () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.TRANSCRIBING,
      });
      expect(useTranscriptionStore.getState().isTranscribing()).toBe(true);
    });

    it("isModelReady returns true in READY state", () => {
      useTranscriptionStore.setState({ state: TranscriptionState.READY });
      expect(useTranscriptionStore.getState().isModelReady()).toBe(true);
    });

    it("isStreaming returns true in STREAMING or RECORDING state", () => {
      useTranscriptionStore.setState({ state: TranscriptionState.STREAMING });
      expect(useTranscriptionStore.getState().isStreaming()).toBe(true);

      useTranscriptionStore.setState({ state: TranscriptionState.RECORDING });
      expect(useTranscriptionStore.getState().isStreaming()).toBe(true);
    });

    it("getError returns message only in ERROR state", () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.ERROR,
        errorMessage: "Boom",
      });
      expect(useTranscriptionStore.getState().getError()).toBe("Boom");

      useTranscriptionStore.setState({ state: TranscriptionState.READY });
      expect(useTranscriptionStore.getState().getError()).toBeNull();
    });
  });

  describe("setError / clearError", () => {
    it("setError transitions to ERROR with message", () => {
      useTranscriptionStore.getState().transitionTo(TranscriptionState.READY);
      useTranscriptionStore.getState().setError("Bad thing");
      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.ERROR,
      );
      expect(useTranscriptionStore.getState().errorMessage).toBe("Bad thing");
    });

    it("clearError transitions from ERROR to READY", () => {
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.ERROR, "err");
      useTranscriptionStore.getState().clearError();
      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.READY,
      );
      expect(useTranscriptionStore.getState().errorMessage).toBeNull();
    });

    it("clearError no-ops when not in ERROR state", () => {
      useTranscriptionStore.getState().transitionTo(TranscriptionState.READY);
      useTranscriptionStore.getState().clearError();
      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.READY,
      );
    });
  });

  describe("streaming text and previews", () => {
    it("updateStreamingText / clearStreamingText", () => {
      useTranscriptionStore.getState().updateStreamingText("hello");
      expect(useTranscriptionStore.getState().currentStreamingText).toBe(
        "hello",
      );

      useTranscriptionStore.getState().clearStreamingText();
      expect(useTranscriptionStore.getState().currentStreamingText).toBe("");
    });

    it("updateLivePreview creates preview with hardcoded ID", () => {
      useTranscriptionStore
        .getState()
        .updateLivePreview("partial text", "session-1");
      const preview = useTranscriptionStore.getState().livePreview!;
      expect(preview.id).toBe("live_active_preview");
      expect(preview.text).toBe("partial text");
      expect(preview.sessionId).toBe("session-1");
    });

    it("clearLivePreview sets null", () => {
      useTranscriptionStore.getState().updateLivePreview("text", "session-1");
      useTranscriptionStore.getState().clearLivePreview();
      expect(useTranscriptionStore.getState().livePreview).toBeNull();
    });

    it("createLoadingPreview creates with hardcoded ID", () => {
      useTranscriptionStore.getState().createLoadingPreview("session-1");
      const preview = useTranscriptionStore.getState().loadingPreview!;
      expect(preview.id).toBe("loading_active_preview");
      expect(preview.sessionId).toBe("session-1");
      expect(preview.text).toBe("");
    });

    it("clearLoadingPreview sets null", () => {
      useTranscriptionStore.getState().createLoadingPreview("session-1");
      useTranscriptionStore.getState().clearLoadingPreview();
      expect(useTranscriptionStore.getState().loadingPreview).toBeNull();
    });

    it("cleanupPreviewsForSessionChange clears mismatched previews", () => {
      useTranscriptionStore.getState().updateLivePreview("text", "session-1");
      useTranscriptionStore.getState().createLoadingPreview("session-1");

      useTranscriptionStore
        .getState()
        .cleanupPreviewsForSessionChange("session-2");

      expect(useTranscriptionStore.getState().livePreview).toBeNull();
      expect(useTranscriptionStore.getState().loadingPreview).toBeNull();
    });

    it("cleanupPreviewsForSessionChange keeps matching previews", () => {
      useTranscriptionStore.getState().updateLivePreview("text", "session-1");
      useTranscriptionStore.getState().createLoadingPreview("session-1");

      useTranscriptionStore
        .getState()
        .cleanupPreviewsForSessionChange("session-1");

      expect(useTranscriptionStore.getState().livePreview).not.toBeNull();
      expect(useTranscriptionStore.getState().loadingPreview).not.toBeNull();
    });
  });

  describe("CRUD operations", () => {
    const tx1 = makeTx({
      id: "tx1",
      timestamp: new Date("2024-01-01"),
    });
    const tx2 = makeTx({
      id: "tx2",
      timestamp: new Date("2024-01-02"),
    });
    const tx3 = makeTx({
      id: "tx3",
      sessionId: "session-2",
      timestamp: new Date("2024-01-03"),
    });

    describe("loadTranscriptions", () => {
      it("loads and sorts by timestamp ascending", async () => {
        (storageService.getTranscriptions as jest.Mock).mockResolvedValueOnce([
          tx2,
          tx1,
        ]);

        // Need READY state to operate, and operation lock needs to be available
        useTranscriptionStore.setState({
          state: TranscriptionState.READY,
          isOperationLocked: false,
          lastOperationTime: null,
        });

        await useTranscriptionStore.getState().loadTranscriptions();
        const txs = useTranscriptionStore.getState().transcriptions;

        expect(txs[0].id).toBe("tx1");
        expect(txs[1].id).toBe("tx2");
        expect(useTranscriptionStore.getState().isLoaded).toBe(true);
      });
    });

    describe("addTranscription", () => {
      it("appends and sorts", () => {
        useTranscriptionStore.setState({ transcriptions: [tx1] });
        useTranscriptionStore.getState().addTranscription(tx2);

        const txs = useTranscriptionStore.getState().transcriptions;
        expect(txs).toHaveLength(2);
        expect(txs[0].id).toBe("tx1");
        expect(txs[1].id).toBe("tx2");
      });
    });

    describe("updateTranscription", () => {
      it("persists update to storage", async () => {
        useSessionStore.setState({ sessions: [testSession] });
        useTranscriptionStore.setState({ transcriptions: [tx1] });
        const updated = { ...tx1, text: "Updated text" };

        await useTranscriptionStore.getState().updateTranscription(updated);

        expect(storageService.saveTranscription).toHaveBeenCalledWith(updated);
        expect(useTranscriptionStore.getState().transcriptions[0].text).toBe(
          "Updated text",
        );
      });

      it("rolls back on storage failure", async () => {
        useTranscriptionStore.setState({ transcriptions: [tx1] });
        (storageService.saveTranscription as jest.Mock).mockRejectedValueOnce(
          new Error("save fail"),
        );

        const updated = { ...tx1, text: "Updated text" };
        await expect(
          useTranscriptionStore.getState().updateTranscription(updated),
        ).rejects.toThrow("Failed to update transcription");

        expect(useTranscriptionStore.getState().transcriptions[0].text).toBe(
          "Hello world",
        );
      });

      it("throws when transcription not found", async () => {
        useTranscriptionStore.setState({ transcriptions: [] });
        await expect(
          useTranscriptionStore
            .getState()
            .updateTranscription(makeTx({ id: "nonexistent" })),
        ).rejects.toThrow("Transcription not found");
      });
    });

    describe("deleteTranscription", () => {
      it("removes from state and calls storage", async () => {
        useSessionStore.setState({ sessions: [testSession] });
        useTranscriptionStore.setState({ transcriptions: [tx1, tx2] });

        await useTranscriptionStore.getState().deleteTranscription("tx1");

        expect(storageService.deleteTranscription).toHaveBeenCalledWith("tx1");
        expect(useTranscriptionStore.getState().transcriptions).toHaveLength(1);
        expect(useTranscriptionStore.getState().transcriptions[0].id).toBe(
          "tx2",
        );
      });

      it("throws when not found", async () => {
        useTranscriptionStore.setState({ transcriptions: [] });
        await expect(
          useTranscriptionStore.getState().deleteTranscription("nonexistent"),
        ).rejects.toThrow("Failed to delete transcription");
      });
    });

    describe("deleteTranscriptions (batch)", () => {
      it("deletes multiple transcriptions", async () => {
        useSessionStore.setState({ sessions: [testSession] });
        useTranscriptionStore.setState({ transcriptions: [tx1, tx2, tx3] });

        await useTranscriptionStore
          .getState()
          .deleteTranscriptions(new Set(["tx1", "tx2"]));

        expect(storageService.deleteTranscription).toHaveBeenCalledTimes(2);
        expect(useTranscriptionStore.getState().transcriptions).toHaveLength(1);
      });
    });

    describe("clearTranscriptions", () => {
      it("clears all and calls storage", async () => {
        useTranscriptionStore.setState({ transcriptions: [tx1, tx2] });

        await useTranscriptionStore.getState().clearTranscriptions();

        expect(storageService.clearTranscriptions).toHaveBeenCalled();
        expect(useTranscriptionStore.getState().transcriptions).toEqual([]);
        expect(useTranscriptionStore.getState().isLoaded).toBe(true);
      });
    });

    describe("deleteParagraphFromTranscription", () => {
      it("removes a paragraph and updates", async () => {
        const txWithParagraphs = makeTx({
          id: "txp",
          text: "Para one\n\nPara two\n\nPara three",
        });
        useSessionStore.setState({ sessions: [testSession] });
        useTranscriptionStore.setState({
          transcriptions: [txWithParagraphs],
        });

        await useTranscriptionStore
          .getState()
          .deleteParagraphFromTranscription("txp", 1);

        const updated = useTranscriptionStore.getState().transcriptions[0];
        expect(updated.text).toBe("Para one\n\nPara three");
      });

      it("deletes entire transcription if removing last paragraph leaves empty text", async () => {
        const txSingle = makeTx({ id: "txs", text: "Only paragraph" });
        useSessionStore.setState({ sessions: [testSession] });
        useTranscriptionStore.setState({ transcriptions: [txSingle] });

        await useTranscriptionStore
          .getState()
          .deleteParagraphFromTranscription("txs", 0);

        expect(storageService.deleteTranscription).toHaveBeenCalledWith("txs");
      });
    });

    describe("deleteAllTranscriptionsForSession", () => {
      it("removes all transcriptions for a session", async () => {
        useSessionStore.setState({ sessions: [testSession] });
        useTranscriptionStore.setState({
          transcriptions: [tx1, tx2, tx3],
        });

        await useTranscriptionStore
          .getState()
          .deleteAllTranscriptionsForSession("session-1");

        expect(
          storageService.deleteTranscriptionsForSession,
        ).toHaveBeenCalledWith("session-1");
        expect(useTranscriptionStore.getState().transcriptions).toHaveLength(1);
        expect(useTranscriptionStore.getState().transcriptions[0].id).toBe(
          "tx3",
        );
      });
    });

    describe("cleanupDeletedSessions", () => {
      it("removes transcriptions for sessions not in valid set", async () => {
        useTranscriptionStore.setState({
          transcriptions: [tx1, tx3],
        });

        const validIds = new Set(["session-1"]);
        await useTranscriptionStore.getState().cleanupDeletedSessions(validIds);

        expect(
          storageService.deleteTranscriptionsForSession,
        ).toHaveBeenCalledWith("session-2");
        expect(useTranscriptionStore.getState().transcriptions).toHaveLength(1);
        expect(useTranscriptionStore.getState().transcriptions[0].id).toBe(
          "tx1",
        );
      });

      it("no-ops when all sessions are valid", async () => {
        useTranscriptionStore.setState({ transcriptions: [tx1] });

        await useTranscriptionStore
          .getState()
          .cleanupDeletedSessions(new Set(["session-1"]));

        expect(
          storageService.deleteTranscriptionsForSession,
        ).not.toHaveBeenCalled();
      });
    });
  });

  describe("initialize()", () => {
    it("loads transcriptions, inits whisper, subscribes audio, transitions to READY", async () => {
      (storageService.getTranscriptions as jest.Mock).mockResolvedValueOnce([]);

      await useTranscriptionStore.getState().initialize();
      const state = useTranscriptionStore.getState();

      expect(state.isInitialized).toBe(true);
      expect(state.isEngineReady).toBe(true);
      expect(state.state).toBe(TranscriptionState.READY);
      expect(sherpaTranscriptionService.initialize).toHaveBeenCalled();
    });

    it("whisper init failure is non-fatal", async () => {
      (storageService.getTranscriptions as jest.Mock).mockResolvedValueOnce([]);
      (
        sherpaTranscriptionService.initialize as jest.Mock
      ).mockResolvedValueOnce(false);

      await useTranscriptionStore.getState().initialize();
      const state = useTranscriptionStore.getState();

      expect(state.isEngineReady).toBe(false);
      expect(state.isInitialized).toBe(true);
      expect(state.state).toBe(TranscriptionState.READY);
    });

    it("skips if already initialized", async () => {
      useTranscriptionStore.setState({ isInitialized: true });

      await useTranscriptionStore.getState().initialize();

      expect(sherpaTranscriptionService.initialize).not.toHaveBeenCalled();
    });

    it("sets error on initialization failure", async () => {
      (storageService.getTranscriptions as jest.Mock).mockRejectedValueOnce(
        new Error("load fail"),
      );

      await useTranscriptionStore.getState().initialize();
      const state = useTranscriptionStore.getState();

      expect(state.initError).not.toBeNull();
      expect(state.state).toBe(TranscriptionState.ERROR);
    });
  });

  describe("startRecording (file mode)", () => {
    beforeEach(() => {
      useTranscriptionStore.setState({
        state: TranscriptionState.READY,
        isEngineReady: true,
        isOperationLocked: false,
        lastOperationTime: null,
      });
      useSettingsStore.setState({
        selectedModelType: ModelType.WHISPER_FILE,
        selectedTranscriptionMode: TranscriptionMode.FILE,
      });
    });

    it("full flow: transitions to RECORDING, starts capture with a WAV sidecar, creates loading preview", async () => {
      const result = await useTranscriptionStore.getState().startRecording();
      const state = useTranscriptionStore.getState();

      expect(result).toBe(true);
      expect(state.state).toBe(TranscriptionState.RECORDING);
      expect(state.recordingSessionId).toBe("session-1");
      expect(state.loadingPreview).not.toBeNull();
      expect(
        sherpaTranscriptionService.startRealtimeTranscription,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          wavOutputUri: expect.stringMatching(/rec_\d+\.wav$/),
        }),
      );
      expect(
        backgroundRecordingService.startBackgroundService,
      ).toHaveBeenCalled();
    });

    it("returns false when not in READY or ERROR state", async () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.TRANSCRIBING,
      });
      const result = await useTranscriptionStore.getState().startRecording();
      expect(result).toBe(false);
    });

    it("initializes whisper if not ready", async () => {
      useTranscriptionStore.setState({ isEngineReady: false });

      await useTranscriptionStore.getState().startRecording();

      expect(sherpaTranscriptionService.initialize).toHaveBeenCalled();
      expect(useTranscriptionStore.getState().isEngineReady).toBe(true);
    });

    it("returns false when whisper init fails", async () => {
      useTranscriptionStore.setState({ isEngineReady: false });
      (
        sherpaTranscriptionService.initialize as jest.Mock
      ).mockResolvedValueOnce(false);

      const result = await useTranscriptionStore.getState().startRecording();
      expect(result).toBe(false);
    });

    it("returns false when capture start fails", async () => {
      (
        sherpaTranscriptionService.startRealtimeTranscription as jest.Mock
      ).mockResolvedValueOnce(false);

      const result = await useTranscriptionStore.getState().startRecording();
      expect(result).toBe(false);
      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.ERROR,
      );
    });

    it("transitions through RECORDING_STARTING while sherpa init is in flight", async () => {
      let resolveInit!: (value: boolean) => void;
      const initPromise = new Promise<boolean>((resolve) => {
        resolveInit = resolve;
      });
      (
        sherpaTranscriptionService.initialize as jest.Mock
      ).mockImplementationOnce(() => initPromise);

      const promise = useTranscriptionStore.getState().startRecording();
      // Let the synchronous portion run up to the await on initialize().
      await Promise.resolve();
      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.RECORDING_STARTING,
      );

      resolveInit(true);
      const result = await promise;
      expect(result).toBe(true);
      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.RECORDING,
      );
    });

    it("recovers to READY when post-init RECORDING transition is blocked", async () => {
      const realTransitionTo = useTranscriptionStore.getState().transitionTo;
      let blocked = false;
      useTranscriptionStore.setState({
        transitionTo: (newState, errorMessage) => {
          if (!blocked && newState === TranscriptionState.RECORDING) {
            blocked = true;
            return false;
          }
          return realTransitionTo(newState, errorMessage);
        },
      });

      try {
        const result = await useTranscriptionStore.getState().startRecording();
        expect(result).toBe(false);
        expect(useTranscriptionStore.getState().state).toBe(
          TranscriptionState.READY,
        );
      } finally {
        useTranscriptionStore.setState({ transitionTo: realTransitionTo });
      }
    });
  });

  describe("AUDIO_BUSY_STATES", () => {
    it("includes RECORDING_STARTING so audio operations back off during init", () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { AUDIO_BUSY_STATES } = require("./transcriptionStore");
      expect(AUDIO_BUSY_STATES.has(TranscriptionState.RECORDING_STARTING)).toBe(
        true,
      );
    });
  });

  describe("startRecording (realtime mode)", () => {
    beforeEach(() => {
      useTranscriptionStore.setState({
        state: TranscriptionState.READY,
        isEngineReady: true,
        isOperationLocked: false,
        lastOperationTime: null,
      });
      useSettingsStore.setState({
        selectedModelType: ModelType.WHISPER_REALTIME,
        selectedTranscriptionMode: TranscriptionMode.REALTIME,
      });
    });

    it("subscribes to chunks + audio levels, starts realtime transcription", async () => {
      const result = await useTranscriptionStore.getState().startRecording();
      const state = useTranscriptionStore.getState();

      expect(result).toBe(true);
      expect(state.state).toBe(TranscriptionState.RECORDING);
      expect(sherpaTranscriptionService.subscribeToChunk).toHaveBeenCalled();
      expect(
        sherpaTranscriptionService.subscribeToAudioLevel,
      ).toHaveBeenCalled();
      expect(
        sherpaTranscriptionService.startRealtimeTranscription,
      ).toHaveBeenCalled();
    });

    it("cleans up on realtime start failure", async () => {
      (
        sherpaTranscriptionService.startRealtimeTranscription as jest.Mock
      ).mockResolvedValueOnce(false);

      const result = await useTranscriptionStore.getState().startRecording();
      expect(result).toBe(false);
      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.ERROR,
      );
      expect(useTranscriptionStore.getState().chunkUnsubscribe).toBeNull();
      expect(
        useTranscriptionStore.getState().realtimeAudioLevelUnsubscribe,
      ).toBeNull();
    });
  });

  describe("stopRecordingAndSave (file mode)", () => {
    beforeEach(() => {
      useTranscriptionStore.setState({
        state: TranscriptionState.RECORDING,
        isEngineReady: true,
        isOperationLocked: false,
        lastOperationTime: null,
        recordingSessionId: "session-1",
      });
      useSettingsStore.setState({
        selectedModelType: ModelType.WHISPER_FILE,
        selectedTranscriptionMode: TranscriptionMode.FILE,
      });
    });

    const primeFileModeSubscription = async () => {
      // Reset smart-split state and stash the chunk callback by running
      // through startRecording so the store wires its subscription up.
      useTranscriptionStore.setState({
        state: TranscriptionState.READY,
        isEngineReady: true,
        isOperationLocked: false,
        lastOperationTime: null,
      });
      await useTranscriptionStore.getState().startRecording();
    };

    it("stops capture, finalizes WAV, saves transcription, transitions to READY", async () => {
      (
        sherpaTranscriptionService.stopRealtimeTranscription as jest.Mock
      ).mockImplementationOnce(async () => {
        capturedChunkCallback?.({
          text: "Transcribed text.",
          boundary: "final",
        });
        return "/tmp/recording.wav";
      });

      await primeFileModeSubscription();
      await useTranscriptionStore.getState().stopRecordingAndSave();
      const state = useTranscriptionStore.getState();

      expect(state.state).toBe(TranscriptionState.READY);
      expect(state.transcriptions).toHaveLength(1);
      expect(state.transcriptions[0].text).toBe("Transcribed text.");
      expect(
        sherpaTranscriptionService.stopRealtimeTranscription,
      ).toHaveBeenCalled();
      expect(storageService.saveTranscription).toHaveBeenCalled();
      // Single-item file-mode runs still attach the WAV for playback.
      expect(storageService.saveAudioFile).toHaveBeenCalled();
      expect(
        backgroundRecordingService.stopBackgroundService,
      ).toHaveBeenCalled();
    });

    it("skips audio attachment and persists all items on a multi-split run", async () => {
      const dateSpy = jest.spyOn(Date, "now");
      (
        sherpaTranscriptionService.stopRealtimeTranscription as jest.Mock
      ).mockImplementationOnce(async () => {
        dateSpy.mockReturnValue(1_000_000);
        (Crypto.randomUUID as jest.Mock).mockReturnValueOnce("id-1");
        capturedChunkCallback?.({ text: "First.", boundary: "none" });
        // Advance past the 60s cap so the long pause actually finalizes.
        dateSpy.mockReturnValue(1_000_000 + 61_000);
        capturedChunkCallback?.({ text: "", boundary: "long" });
        (Crypto.randomUUID as jest.Mock).mockReturnValueOnce("id-2");
        capturedChunkCallback?.({ text: "Second.", boundary: "final" });
        return "/tmp/recording.wav";
      });
      await primeFileModeSubscription();

      await useTranscriptionStore.getState().stopRecordingAndSave();
      dateSpy.mockRestore();

      const state = useTranscriptionStore.getState();
      expect(state.transcriptions).toHaveLength(2);
      expect(storageService.saveAudioFile).not.toHaveBeenCalled();
      expect(storageService.saveTranscription).toHaveBeenCalledTimes(2);
      expect(state.transcriptions.every((t) => t.audioPath === "")).toBe(true);
    });

    it("skips persist for incognito session", async () => {
      (
        sherpaTranscriptionService.stopRealtimeTranscription as jest.Mock
      ).mockImplementationOnce(async () => {
        capturedChunkCallback?.({
          text: "Transcribed text.",
          boundary: "final",
        });
        return "/tmp/recording.wav";
      });
      const incognito = {
        id: "inc",
        name: "Incognito",
        timestamp: new Date(),
        lastModified: new Date(),
        isIncognito: true,
      };
      useSessionStore.setState({
        activeSessionId: "inc",
        incognitoSession: incognito,
      });
      await primeFileModeSubscription();
      useTranscriptionStore.setState({ recordingSessionId: "inc" });

      await useTranscriptionStore.getState().stopRecordingAndSave();

      expect(storageService.saveTranscription).not.toHaveBeenCalled();
      expect(useTranscriptionStore.getState().transcriptions).toHaveLength(1);
    });

    it("errors when no chunks were captured", async () => {
      (
        sherpaTranscriptionService.stopRealtimeTranscription as jest.Mock
      ).mockImplementationOnce(async () => null);
      await primeFileModeSubscription();

      await useTranscriptionStore.getState().stopRecordingAndSave();

      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.READY,
      );
      expect(useTranscriptionStore.getState().transcriptions).toHaveLength(0);
    });

    it("persists text without audio when WAV finalize fails", async () => {
      (
        sherpaTranscriptionService.stopRealtimeTranscription as jest.Mock
      ).mockImplementationOnce(async () => {
        capturedChunkCallback?.({
          text: "Transcribed text.",
          boundary: "final",
        });
        return null;
      });
      await primeFileModeSubscription();

      await useTranscriptionStore.getState().stopRecordingAndSave();

      const state = useTranscriptionStore.getState();
      expect(state.transcriptions).toHaveLength(1);
      expect(state.transcriptions[0].audioPath).toBe("");
      expect(storageService.saveAudioFile).not.toHaveBeenCalled();
      expect(storageService.saveTranscription).toHaveBeenCalled();
    });
  });

  describe("stopRecordingAndSave (realtime mode)", () => {
    const mockPartialUnsub = jest.fn();
    const mockAudioLevelUnsub = jest.fn();

    beforeEach(() => {
      mockPartialUnsub.mockClear();
      mockAudioLevelUnsub.mockClear();
      // Emulate what startRecording does: wire the chunk callback so the
      // stop mock can emit a `final` event through it.
      capturedChunkCallback = (event) => {
        useTranscriptionStore.getState().onChunkEvent(event);
      };
      useTranscriptionStore.setState({
        state: TranscriptionState.RECORDING,
        isEngineReady: true,
        isOperationLocked: false,
        lastOperationTime: null,
        recordingSessionId: "session-1",
        chunkUnsubscribe: mockPartialUnsub,
        realtimeAudioLevelUnsubscribe: mockAudioLevelUnsub,
      });
      useSettingsStore.setState({
        selectedModelType: ModelType.WHISPER_REALTIME,
        selectedTranscriptionMode: TranscriptionMode.REALTIME,
      });
    });

    it("stops whisper realtime and cleans up subscriptions", async () => {
      await useTranscriptionStore.getState().stopRecordingAndSave();

      expect(
        sherpaTranscriptionService.stopRealtimeTranscription,
      ).toHaveBeenCalled();
      expect(mockPartialUnsub).toHaveBeenCalled();
      expect(mockAudioLevelUnsub).toHaveBeenCalled();
      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.READY,
      );
    });

    it("handles empty realtime text", async () => {
      (
        sherpaTranscriptionService.stopRealtimeTranscription as jest.Mock
      ).mockImplementationOnce(async () => {
        capturedChunkCallback?.({ text: "", boundary: "final" });
      });

      await useTranscriptionStore.getState().stopRecordingAndSave();

      expect(useTranscriptionStore.getState().transcriptions).toHaveLength(0);
      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.READY,
      );
    });
  });

  describe("stopRecordingAndSave (shared)", () => {
    it("no-ops when not recording", async () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.READY,
      });

      await useTranscriptionStore.getState().stopRecordingAndSave();

      expect(
        sherpaTranscriptionService.stopRealtimeTranscription,
      ).not.toHaveBeenCalled();
    });

    it("always stops background service", async () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.RECORDING,
        isOperationLocked: false,
        lastOperationTime: null,
        recordingSessionId: "session-1",
      });

      await useTranscriptionStore.getState().stopRecordingAndSave();

      expect(
        backgroundRecordingService.stopBackgroundService,
      ).toHaveBeenCalled();
    });

    it("always clears recording session ID", async () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.RECORDING,
        isOperationLocked: false,
        lastOperationTime: null,
        recordingSessionId: "session-1",
      });

      await useTranscriptionStore.getState().stopRecordingAndSave();

      expect(useTranscriptionStore.getState().recordingSessionId).toBeNull();
    });
  });

  describe("onChunkEvent", () => {
    it("accumulates text and updates live preview when RECORDING", () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.RECORDING,
        recordingSessionId: "session-1",
      });

      useTranscriptionStore.getState().onChunkEvent({
        text: "partial text",
        boundary: "none",
      });

      expect(useTranscriptionStore.getState().currentStreamingText).toBe(
        "partial text",
      );
      expect(useTranscriptionStore.getState().livePreview!.text).toBe(
        "partial text",
      );
    });

    it("updates live preview when STREAMING", () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.STREAMING,
        recordingSessionId: "session-1",
      });

      useTranscriptionStore.getState().onChunkEvent({
        text: "streamed",
        boundary: "none",
      });

      expect(useTranscriptionStore.getState().livePreview!.text).toBe(
        "streamed",
      );
    });

    it("updates streaming text but not preview in READY state", () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.READY,
      });

      useTranscriptionStore.getState().onChunkEvent({
        text: "text",
        boundary: "none",
      });

      expect(useTranscriptionStore.getState().currentStreamingText).toBe(
        "text",
      );
      expect(useTranscriptionStore.getState().livePreview).toBeNull();
    });
  });

  describe("forceSystemReset", () => {
    it("cleans up subscriptions, stops bg service, resets state", async () => {
      const mockUnsub1 = jest.fn();
      const mockUnsub2 = jest.fn();
      useTranscriptionStore.setState({
        state: TranscriptionState.RECORDING,
        chunkUnsubscribe: mockUnsub1,
        realtimeAudioLevelUnsubscribe: mockUnsub2,
        isOperationLocked: true,
        recordingSessionId: "session-1",
      });

      await useTranscriptionStore.getState().forceSystemReset();

      expect(mockUnsub1).toHaveBeenCalled();
      expect(mockUnsub2).toHaveBeenCalled();
      expect(
        backgroundRecordingService.stopBackgroundService,
      ).toHaveBeenCalled();
      expect(useTranscriptionStore.getState().isOperationLocked).toBe(false);
      expect(useTranscriptionStore.getState().recordingSessionId).toBeNull();
      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.READY,
      );
    });
  });

  describe("dispose", () => {
    it("unsubscribes all, stops bg service, disposes services", async () => {
      const mockPartial = jest.fn();
      const mockRealtime = jest.fn();
      useTranscriptionStore.setState({
        chunkUnsubscribe: mockPartial,
        realtimeAudioLevelUnsubscribe: mockRealtime,
      });

      await useTranscriptionStore.getState().dispose();

      expect(mockPartial).toHaveBeenCalled();
      expect(mockRealtime).toHaveBeenCalled();
      expect(
        backgroundRecordingService.stopBackgroundService,
      ).toHaveBeenCalled();
      expect(sherpaTranscriptionService.dispose).toHaveBeenCalled();
    });
  });

  describe("sessionTranscriptions", () => {
    it("filters by session ID", () => {
      const tx1 = makeTx({ id: "tx1", sessionId: "session-1" });
      const tx2 = makeTx({ id: "tx2", sessionId: "session-2" });
      useTranscriptionStore.setState({ transcriptions: [tx1, tx2] });

      const result = useTranscriptionStore
        .getState()
        .sessionTranscriptions("session-1");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("tx1");
    });
  });

  describe("getLivePreviewForSession / getLoadingPreviewForSession", () => {
    it("returns preview when sessionId matches", () => {
      useTranscriptionStore.getState().updateLivePreview("text", "session-1");
      expect(
        useTranscriptionStore.getState().getLivePreviewForSession("session-1"),
      ).not.toBeNull();
      expect(
        useTranscriptionStore.getState().getLivePreviewForSession("session-2"),
      ).toBeNull();
    });

    it("returns loading preview when sessionId matches", () => {
      useTranscriptionStore.getState().createLoadingPreview("session-1");
      expect(
        useTranscriptionStore
          .getState()
          .getLoadingPreviewForSession("session-1"),
      ).not.toBeNull();
      expect(
        useTranscriptionStore
          .getState()
          .getLoadingPreviewForSession("session-2"),
      ).toBeNull();
    });
  });

  describe("startRecording - additional branches", () => {
    beforeEach(() => {
      useTranscriptionStore.setState({
        state: TranscriptionState.READY,
        isEngineReady: true,
        isOperationLocked: false,
        lastOperationTime: null,
      });
      jest.clearAllMocks();
      (Crypto.randomUUID as jest.Mock).mockReturnValue("transcription-uuid");
    });

    it("returns false when acquireOperationLock fails (operation locked)", async () => {
      useTranscriptionStore.setState({ isOperationLocked: true });

      const result = await useTranscriptionStore.getState().startRecording();
      expect(result).toBe(false);
    });

    it("returns false when operation is too soon after last operation", async () => {
      useTranscriptionStore.setState({
        lastOperationTime: new Date(), // just now
      });

      const result = await useTranscriptionStore.getState().startRecording();
      expect(result).toBe(false);
    });

    it("can start recording from ERROR state", async () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.ERROR,
        errorMessage: "previous error",
      });

      const result = await useTranscriptionStore.getState().startRecording();
      expect(result).toBe(true);
      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.RECORDING,
      );
    });

    it("logs warning but continues when background service fails to start (file mode)", async () => {
      useSettingsStore.setState({
        selectedModelType: ModelType.WHISPER_FILE,
        selectedTranscriptionMode: TranscriptionMode.FILE,
      });
      (
        backgroundRecordingService.startBackgroundService as jest.Mock
      ).mockResolvedValueOnce(false);

      const result = await useTranscriptionStore.getState().startRecording();
      expect(result).toBe(true);
      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.RECORDING,
      );
    });

    it("stops background service when file-mode capture start fails and bg was started", async () => {
      useSettingsStore.setState({
        selectedModelType: ModelType.WHISPER_FILE,
        selectedTranscriptionMode: TranscriptionMode.FILE,
      });
      (
        sherpaTranscriptionService.startRealtimeTranscription as jest.Mock
      ).mockResolvedValueOnce(false);
      (
        backgroundRecordingService.startBackgroundService as jest.Mock
      ).mockResolvedValueOnce(true);

      const result = await useTranscriptionStore.getState().startRecording();
      expect(result).toBe(false);
      expect(
        backgroundRecordingService.stopBackgroundService,
      ).toHaveBeenCalled();
      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.ERROR,
      );
    });

    it("does NOT stop background service when file-mode start fails and bg was not started", async () => {
      useSettingsStore.setState({
        selectedModelType: ModelType.WHISPER_FILE,
        selectedTranscriptionMode: TranscriptionMode.FILE,
      });
      (
        sherpaTranscriptionService.startRealtimeTranscription as jest.Mock
      ).mockResolvedValueOnce(false);
      (
        backgroundRecordingService.startBackgroundService as jest.Mock
      ).mockResolvedValueOnce(false);

      const result = await useTranscriptionStore.getState().startRecording();
      expect(result).toBe(false);
      expect(
        backgroundRecordingService.stopBackgroundService,
      ).not.toHaveBeenCalled();
    });

    it("stops background service when realtime start fails and bg was started", async () => {
      useSettingsStore.setState({
        selectedModelType: ModelType.WHISPER_REALTIME,
        selectedTranscriptionMode: TranscriptionMode.REALTIME,
      });
      (
        sherpaTranscriptionService.startRealtimeTranscription as jest.Mock
      ).mockResolvedValueOnce(false);
      (
        backgroundRecordingService.startBackgroundService as jest.Mock
      ).mockResolvedValueOnce(true);

      const result = await useTranscriptionStore.getState().startRecording();
      expect(result).toBe(false);
      expect(
        backgroundRecordingService.stopBackgroundService,
      ).toHaveBeenCalled();
      expect(useTranscriptionStore.getState().recordingSessionId).toBeNull();
    });

    it("does NOT stop background service when realtime start fails and bg was not started", async () => {
      useSettingsStore.setState({
        selectedModelType: ModelType.WHISPER_REALTIME,
        selectedTranscriptionMode: TranscriptionMode.REALTIME,
      });
      (
        sherpaTranscriptionService.startRealtimeTranscription as jest.Mock
      ).mockResolvedValueOnce(false);
      (
        backgroundRecordingService.startBackgroundService as jest.Mock
      ).mockResolvedValueOnce(false);

      const result = await useTranscriptionStore.getState().startRecording();
      expect(result).toBe(false);
      expect(
        backgroundRecordingService.stopBackgroundService,
      ).not.toHaveBeenCalled();
    });

    it("handles unexpected exception during startRecording and cleans up subscriptions", async () => {
      useSettingsStore.setState({
        selectedModelType: ModelType.WHISPER_REALTIME,
        selectedTranscriptionMode: TranscriptionMode.REALTIME,
      });
      const mockAudioUnsub = jest.fn();
      const mockPartialUnsub = jest.fn();

      (
        sherpaTranscriptionService.subscribeToAudioLevel as jest.Mock
      ).mockReturnValueOnce(mockAudioUnsub);
      (
        sherpaTranscriptionService.subscribeToChunk as jest.Mock
      ).mockImplementationOnce((cb: (event: ChunkEvent) => void) => {
        capturedChunkCallback = cb;
        return mockPartialUnsub;
      });
      (
        sherpaTranscriptionService.startRealtimeTranscription as jest.Mock
      ).mockRejectedValueOnce(new Error("unexpected error"));

      const result = await useTranscriptionStore.getState().startRecording();
      expect(result).toBe(false);
      expect(mockAudioUnsub).toHaveBeenCalled();
      expect(mockPartialUnsub).toHaveBeenCalled();
      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.ERROR,
      );
    });

    it("logs warning but continues when background service fails to start (realtime mode)", async () => {
      useSettingsStore.setState({
        selectedModelType: ModelType.WHISPER_REALTIME,
        selectedTranscriptionMode: TranscriptionMode.REALTIME,
      });
      (
        backgroundRecordingService.startBackgroundService as jest.Mock
      ).mockResolvedValueOnce(false);

      const result = await useTranscriptionStore.getState().startRecording();
      expect(result).toBe(true);
      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.RECORDING,
      );
    });
  });

  describe("stopRecordingAndSave - additional branches", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      (Crypto.randomUUID as jest.Mock).mockReturnValue("transcription-uuid");
    });

    it("returns early when not recording", async () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.READY,
      });

      await useTranscriptionStore.getState().stopRecordingAndSave();

      expect(
        sherpaTranscriptionService.stopRealtimeTranscription,
      ).not.toHaveBeenCalled();
    });

    it("allows stopRecordingAndSave through lock when state is RECORDING", async () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.RECORDING,
        isOperationLocked: true,
        lastOperationTime: null,
        recordingSessionId: "session-1",
      });

      await useTranscriptionStore.getState().stopRecordingAndSave();
      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.READY,
      );
    });

    it("handles error during stop and recovers to READY state", async () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.RECORDING,
        isOperationLocked: false,
        lastOperationTime: null,
        recordingSessionId: "session-1",
      });
      useSettingsStore.setState({
        selectedModelType: ModelType.WHISPER_FILE,
        selectedTranscriptionMode: TranscriptionMode.FILE,
      });
      (
        sherpaTranscriptionService.stopRealtimeTranscription as jest.Mock
      ).mockRejectedValueOnce(new Error("stop error"));

      await useTranscriptionStore.getState().stopRecordingAndSave();

      expect(useTranscriptionStore.getState().livePreview).toBeNull();
      expect(useTranscriptionStore.getState().loadingPreview).toBeNull();
      expect(useTranscriptionStore.getState().recordingSessionId).toBeNull();
      expect(
        backgroundRecordingService.stopBackgroundService,
      ).toHaveBeenCalled();
    });

    it("handles null sessionId (no session set)", async () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.RECORDING,
        isOperationLocked: false,
        lastOperationTime: null,
        recordingSessionId: null,
      });
      useSettingsStore.setState({
        selectedModelType: ModelType.WHISPER_FILE,
        selectedTranscriptionMode: TranscriptionMode.FILE,
      });

      await useTranscriptionStore.getState().stopRecordingAndSave();

      expect(useTranscriptionStore.getState().transcriptions).toHaveLength(0);
      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.READY,
      );
    });

    const primeChunkCallback = () => {
      capturedChunkCallback = (event) => {
        useTranscriptionStore.getState().onChunkEvent(event);
      };
    };

    it("file mode saves WAV with .wav extension when sidecar finalized", async () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.RECORDING,
        isOperationLocked: false,
        lastOperationTime: null,
        recordingSessionId: "session-1",
      });
      useSettingsStore.setState({
        selectedModelType: ModelType.WHISPER_FILE,
        selectedTranscriptionMode: TranscriptionMode.FILE,
      });
      primeChunkCallback();
      (
        sherpaTranscriptionService.stopRealtimeTranscription as jest.Mock
      ).mockImplementationOnce(async () => {
        capturedChunkCallback?.({
          text: "Transcribed text.",
          boundary: "final",
        });
        return "/tmp/rec_123.wav";
      });

      await useTranscriptionStore.getState().stopRecordingAndSave();

      expect(storageService.saveAudioFile).toHaveBeenCalledWith(
        "/tmp/rec_123.wav",
        expect.stringMatching(/^audio_\d+\.wav$/),
      );
    });

    it("realtime mode saves transcription with empty audioPath", async () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.RECORDING,
        isOperationLocked: false,
        lastOperationTime: null,
        recordingSessionId: "session-1",
        chunkUnsubscribe: jest.fn(),
        realtimeAudioLevelUnsubscribe: jest.fn(),
      });
      useSettingsStore.setState({
        selectedModelType: ModelType.WHISPER_REALTIME,
        selectedTranscriptionMode: TranscriptionMode.REALTIME,
      });
      primeChunkCallback();

      await useTranscriptionStore.getState().stopRecordingAndSave();

      const txs = useTranscriptionStore.getState().transcriptions;
      expect(txs).toHaveLength(1);
      expect(txs[0].audioPath).toBe("");
      expect(storageService.saveTranscription).toHaveBeenCalled();
    });

    it("skips persist for incognito session in realtime mode", async () => {
      const incognito = {
        id: "inc",
        name: "Incognito",
        timestamp: new Date(),
        lastModified: new Date(),
        isIncognito: true,
      };
      useSessionStore.setState({
        activeSessionId: "inc",
        incognitoSession: incognito,
      });
      useTranscriptionStore.setState({
        state: TranscriptionState.RECORDING,
        isOperationLocked: false,
        lastOperationTime: null,
        recordingSessionId: "inc",
        chunkUnsubscribe: jest.fn(),
        realtimeAudioLevelUnsubscribe: jest.fn(),
      });
      useSettingsStore.setState({
        selectedModelType: ModelType.WHISPER_REALTIME,
        selectedTranscriptionMode: TranscriptionMode.REALTIME,
      });
      primeChunkCallback();

      await useTranscriptionStore.getState().stopRecordingAndSave();

      expect(storageService.saveTranscription).not.toHaveBeenCalled();
      expect(useTranscriptionStore.getState().transcriptions).toHaveLength(1);
    });

    it("handles background service stop failure in finally block gracefully", async () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.RECORDING,
        isOperationLocked: false,
        lastOperationTime: null,
        recordingSessionId: "session-1",
      });
      useSettingsStore.setState({
        selectedModelType: ModelType.WHISPER_FILE,
        selectedTranscriptionMode: TranscriptionMode.FILE,
      });
      (
        backgroundRecordingService.stopBackgroundService as jest.Mock
      ).mockRejectedValueOnce(new Error("bg stop error"));

      await useTranscriptionStore.getState().stopRecordingAndSave();

      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.READY,
      );
    });
  });

  describe("deleteParagraphFromTranscription - additional branches", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      (Crypto.randomUUID as jest.Mock).mockReturnValue("transcription-uuid");
    });

    it("throws when transcription not found", async () => {
      useTranscriptionStore.setState({ transcriptions: [] });
      await expect(
        useTranscriptionStore
          .getState()
          .deleteParagraphFromTranscription("nonexistent", 0),
      ).rejects.toThrow("Failed to delete paragraph");
    });

    it("throws when paragraph index is negative", async () => {
      const tx = makeTx({ id: "txp", text: "Para one\n\nPara two" });
      useSessionStore.setState({ sessions: [testSession] });
      useTranscriptionStore.setState({ transcriptions: [tx] });

      await expect(
        useTranscriptionStore
          .getState()
          .deleteParagraphFromTranscription("txp", -1),
      ).rejects.toThrow("Failed to delete paragraph");
    });

    it("throws when paragraph index is out of bounds", async () => {
      const tx = makeTx({ id: "txp", text: "Para one\n\nPara two" });
      useSessionStore.setState({ sessions: [testSession] });
      useTranscriptionStore.setState({ transcriptions: [tx] });

      await expect(
        useTranscriptionStore
          .getState()
          .deleteParagraphFromTranscription("txp", 5),
      ).rejects.toThrow("Failed to delete paragraph");
    });
  });

  describe("cleanupDeletedSessions - additional branches", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("skips empty session IDs during cleanup", async () => {
      const txEmpty = makeTx({ id: "txe", sessionId: "" });
      const txValid = makeTx({ id: "txv", sessionId: "session-1" });
      useTranscriptionStore.setState({
        transcriptions: [txEmpty, txValid],
      });

      await useTranscriptionStore
        .getState()
        .cleanupDeletedSessions(new Set(["session-1"]));

      expect(
        storageService.deleteTranscriptionsForSession,
      ).not.toHaveBeenCalledWith("");
      expect(useTranscriptionStore.getState().transcriptions).toHaveLength(1);
      expect(useTranscriptionStore.getState().transcriptions[0].id).toBe("txv");
    });
  });

  describe("forceSystemReset - additional branches", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("handles null subscriptions gracefully", async () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.RECORDING,
        chunkUnsubscribe: null,
        realtimeAudioLevelUnsubscribe: null,
        isOperationLocked: true,
        recordingSessionId: "session-1",
        livePreview: {
          id: "live_active_preview",
          text: "some text",
          timestamp: new Date(),
          sessionId: "session-1",
          audioPath: "",
        },
        loadingPreview: {
          id: "loading_active_preview",
          text: "",
          timestamp: new Date(),
          sessionId: "session-1",
          audioPath: "",
        },
      });

      await useTranscriptionStore.getState().forceSystemReset();

      expect(useTranscriptionStore.getState().isOperationLocked).toBe(false);
      expect(useTranscriptionStore.getState().recordingSessionId).toBeNull();
      expect(useTranscriptionStore.getState().livePreview).toBeNull();
      expect(useTranscriptionStore.getState().loadingPreview).toBeNull();
      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.READY,
      );
    });

    it("handles background service stop failure during reset", async () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.RECORDING,
        chunkUnsubscribe: null,
        realtimeAudioLevelUnsubscribe: null,
      });
      (
        backgroundRecordingService.stopBackgroundService as jest.Mock
      ).mockRejectedValueOnce(new Error("bg error"));

      await useTranscriptionStore.getState().forceSystemReset();

      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.READY,
      );
    });
  });

  describe("dispose - additional branches", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("handles null subscriptions gracefully", async () => {
      useTranscriptionStore.setState({
        chunkUnsubscribe: null,
        realtimeAudioLevelUnsubscribe: null,
      });

      await useTranscriptionStore.getState().dispose();

      expect(sherpaTranscriptionService.dispose).toHaveBeenCalled();
      expect(
        backgroundRecordingService.stopBackgroundService,
      ).toHaveBeenCalled();
    });

    it("handles background service stop failure during dispose", async () => {
      useTranscriptionStore.setState({
        chunkUnsubscribe: null,
        realtimeAudioLevelUnsubscribe: null,
      });
      (
        backgroundRecordingService.stopBackgroundService as jest.Mock
      ).mockRejectedValueOnce(new Error("bg error"));

      await useTranscriptionStore.getState().dispose();

      expect(sherpaTranscriptionService.dispose).toHaveBeenCalled();
    });
  });

  describe("clearErrorState", () => {
    it("transitions from ERROR to READY", () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.ERROR,
        errorMessage: "some error",
      });

      useTranscriptionStore.getState().clearErrorState();

      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.READY,
      );
    });

    it("no-ops when not in ERROR state", () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.READY,
      });

      useTranscriptionStore.getState().clearErrorState();

      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.READY,
      );
    });

    it("no-ops when in RECORDING state", () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.RECORDING,
      });

      useTranscriptionStore.getState().clearErrorState();

      expect(useTranscriptionStore.getState().state).toBe(
        TranscriptionState.RECORDING,
      );
    });
  });

  describe("initializeTranscriptionStore", () => {
    it("calls initialize on the store", async () => {
      (storageService.getTranscriptions as jest.Mock).mockResolvedValueOnce([]);

      await initializeTranscriptionStore();

      expect(useTranscriptionStore.getState().isInitialized).toBe(true);
    });
  });

  describe("selector hooks", () => {
    beforeEach(() => {
      useTranscriptionStore.setState({
        ...getInitialState(),
        state: TranscriptionState.READY,
      });
    });

    it("useTranscriptionState returns current state", () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.RECORDING,
      });
      const { result } = renderHook(() => useTranscriptionState());
      expect(result.current).toBe(TranscriptionState.RECORDING);
    });

    it("useIsRecording returns false when not recording", () => {
      const { result } = renderHook(() => useIsRecording());
      expect(result.current).toBe(false);
    });

    it("useIsRecording returns true when recording", () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.RECORDING,
      });
      const { result } = renderHook(() => useIsRecording());
      expect(result.current).toBe(true);
    });

    it("useAudioLevel returns 0 by default", () => {
      const { result } = renderHook(() => useAudioLevel());
      expect(result.current).toBe(0);
    });

    it("useAudioLevel returns current audio level", () => {
      useTranscriptionStore.setState({ audioLevel: 0.75 });
      const { result } = renderHook(() => useAudioLevel());
      expect(result.current).toBe(0.75);
    });

    it("useStartRecording returns a function", () => {
      const { result } = renderHook(() => useStartRecording());
      expect(typeof result.current).toBe("function");
    });

    it("useStopRecordingAndSave returns a function", () => {
      const { result } = renderHook(() => useStopRecordingAndSave());
      expect(typeof result.current).toBe("function");
    });

    it("useDeleteTranscriptions returns a function", () => {
      const { result } = renderHook(() => useDeleteTranscriptions());
      expect(typeof result.current).toBe("function");
    });

    it("useLivePreview returns null by default", () => {
      const { result } = renderHook(() => useLivePreview());
      expect(result.current).toBeNull();
    });

    it("useLivePreview returns live preview when set", () => {
      useTranscriptionStore.getState().updateLivePreview("text", "session-1");
      const { result } = renderHook(() => useLivePreview());
      expect(result.current).not.toBeNull();
      expect(result.current!.text).toBe("text");
    });

    it("useSessionTranscriptions returns filtered transcriptions for active session", () => {
      const tx1Local = makeTx({ id: "tx1", sessionId: "session-1" });
      const tx2Local = makeTx({ id: "tx2", sessionId: "session-2" });
      useTranscriptionStore.setState({ transcriptions: [tx1Local, tx2Local] });
      useSessionStore.setState({ activeSessionId: "session-1" });

      const { result } = renderHook(() => useSessionTranscriptions());
      expect(result.current).toHaveLength(1);
      expect(result.current[0].id).toBe("tx1");
    });

    it("useSessionTranscriptions uses provided sessionId over active session", () => {
      const tx1Local = makeTx({ id: "tx1", sessionId: "session-1" });
      const tx2Local = makeTx({ id: "tx2", sessionId: "session-2" });
      useTranscriptionStore.setState({ transcriptions: [tx1Local, tx2Local] });
      useSessionStore.setState({ activeSessionId: "session-1" });

      const { result } = renderHook(() =>
        useSessionTranscriptions("session-2"),
      );
      expect(result.current).toHaveLength(1);
      expect(result.current[0].id).toBe("tx2");
    });

    it("useSessionTranscriptions returns empty array when no matching transcriptions", () => {
      useTranscriptionStore.setState({ transcriptions: [] });
      useSessionStore.setState({ activeSessionId: "session-1" });

      const { result } = renderHook(() => useSessionTranscriptions());
      expect(result.current).toEqual([]);
    });
  });

  describe("loadTranscriptions - additional branches", () => {
    it("throws when operation lock cannot be acquired", async () => {
      useTranscriptionStore.setState({
        isOperationLocked: true,
      });

      await expect(
        useTranscriptionStore.getState().loadTranscriptions(),
      ).rejects.toThrow("Cannot load transcriptions - system is busy");
    });

    it("rethrows storage errors", async () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.READY,
        isOperationLocked: false,
        lastOperationTime: null,
      });
      (storageService.getTranscriptions as jest.Mock).mockRejectedValueOnce(
        new Error("storage error"),
      );

      await expect(
        useTranscriptionStore.getState().loadTranscriptions(),
      ).rejects.toThrow("storage error");
    });
  });

  describe("clearLivePreview / clearLoadingPreview - edge cases", () => {
    it("clearLivePreview no-ops when already null", () => {
      useTranscriptionStore.setState({ livePreview: null });
      useTranscriptionStore.getState().clearLivePreview();
      expect(useTranscriptionStore.getState().livePreview).toBeNull();
    });

    it("clearLoadingPreview no-ops when already null", () => {
      useTranscriptionStore.setState({ loadingPreview: null });
      useTranscriptionStore.getState().clearLoadingPreview();
      expect(useTranscriptionStore.getState().loadingPreview).toBeNull();
    });
  });

  describe("updateAudioLevel / setRecordingSessionId / clearRecordingSessionId", () => {
    it("updateAudioLevel sets the level", () => {
      useTranscriptionStore.getState().updateAudioLevel(0.5);
      expect(useTranscriptionStore.getState().audioLevel).toBe(0.5);
    });

    it("setRecordingSessionId sets session ID", () => {
      useTranscriptionStore.getState().setRecordingSessionId("sess-123");
      expect(useTranscriptionStore.getState().recordingSessionId).toBe(
        "sess-123",
      );
    });

    it("clearRecordingSessionId clears session ID", () => {
      useTranscriptionStore.getState().setRecordingSessionId("sess-123");
      useTranscriptionStore.getState().clearRecordingSessionId();
      expect(useTranscriptionStore.getState().recordingSessionId).toBeNull();
    });
  });

  describe("additional state machine transitions", () => {
    it("STREAMING -> READY is valid", () => {
      useTranscriptionStore.getState().transitionTo(TranscriptionState.READY);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.RECORDING_STARTING);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.RECORDING);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.STREAMING);
      expect(
        useTranscriptionStore.getState().transitionTo(TranscriptionState.READY),
      ).toBe(true);
    });

    it("STREAMING -> ERROR is valid", () => {
      useTranscriptionStore.getState().transitionTo(TranscriptionState.READY);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.RECORDING_STARTING);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.RECORDING);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.STREAMING);
      expect(
        useTranscriptionStore
          .getState()
          .transitionTo(TranscriptionState.ERROR, "stream error"),
      ).toBe(true);
    });

    it("ERROR -> LOADING is valid", () => {
      useTranscriptionStore.getState().transitionTo(TranscriptionState.ERROR);
      expect(
        useTranscriptionStore
          .getState()
          .transitionTo(TranscriptionState.LOADING),
      ).toBe(true);
    });

    it("RECORDING -> READY is valid", () => {
      useTranscriptionStore.getState().transitionTo(TranscriptionState.READY);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.RECORDING_STARTING);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.RECORDING);
      expect(
        useTranscriptionStore.getState().transitionTo(TranscriptionState.READY),
      ).toBe(true);
    });

    it("RECORDING -> ERROR is valid", () => {
      useTranscriptionStore.getState().transitionTo(TranscriptionState.READY);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.RECORDING_STARTING);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.RECORDING);
      expect(
        useTranscriptionStore
          .getState()
          .transitionTo(TranscriptionState.ERROR, "rec error"),
      ).toBe(true);
    });

    it("TRANSCRIBING -> ERROR is valid", () => {
      useTranscriptionStore.getState().transitionTo(TranscriptionState.READY);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.RECORDING_STARTING);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.RECORDING);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.TRANSCRIBING);
      expect(
        useTranscriptionStore
          .getState()
          .transitionTo(TranscriptionState.ERROR, "transcribe error"),
      ).toBe(true);
    });

    it("READY -> LOADING is valid", () => {
      useTranscriptionStore.getState().transitionTo(TranscriptionState.READY);
      expect(
        useTranscriptionStore
          .getState()
          .transitionTo(TranscriptionState.LOADING),
      ).toBe(true);
    });

    it("READY -> ERROR is valid", () => {
      useTranscriptionStore.getState().transitionTo(TranscriptionState.READY);
      expect(
        useTranscriptionStore.getState().transitionTo(TranscriptionState.ERROR),
      ).toBe(true);
    });
  });

  describe("onChunkEvent - sessionId fallback", () => {
    it("uses activeSessionId when recordingSessionId is null", () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.RECORDING,
        recordingSessionId: null,
      });
      useSessionStore.setState({ activeSessionId: "fallback-session" });

      useTranscriptionStore.getState().onChunkEvent({
        text: "partial",
        boundary: "none",
      });

      const preview = useTranscriptionStore.getState().livePreview;
      expect(preview).not.toBeNull();
      expect(preview!.sessionId).toBe("fallback-session");
    });
  });

  describe("initialize - additional branches", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      useTranscriptionStore.setState(getInitialState());
    });

    it("sets error when operation lock cannot be acquired during init", async () => {
      useTranscriptionStore.setState({
        isOperationLocked: true,
      });

      await useTranscriptionStore.getState().initialize();

      const state = useTranscriptionStore.getState();
      expect(state.initError).not.toBeNull();
    });
  });

  describe("stopRecordingAndSave - transition failure", () => {
    it("returns early when transition to TRANSCRIBING fails", async () => {
      // Set state that cannot transition to TRANSCRIBING
      useTranscriptionStore.setState({
        state: TranscriptionState.RECORDING,
        isOperationLocked: false,
        lastOperationTime: null,
        recordingSessionId: "session-1",
      });

      // Force transition to fail by mocking transitionTo
      const origTransitionTo = useTranscriptionStore.getState().transitionTo;
      useTranscriptionStore.setState({
        transitionTo: (newState: TranscriptionState) => {
          if (newState === TranscriptionState.TRANSCRIBING) {
            return false;
          }
          return origTransitionTo(newState);
        },
      });

      await useTranscriptionStore.getState().stopRecordingAndSave();

      // Should not have called capture stop since transition failed
      expect(
        sherpaTranscriptionService.stopRealtimeTranscription,
      ).not.toHaveBeenCalled();
    });
  });

  describe("deleteTranscriptions - edge cases", () => {
    it("skips deletion for IDs not found in state", async () => {
      const tx1 = makeTx({ id: "tx1" });
      useSessionStore.setState({ sessions: [testSession] });
      useTranscriptionStore.setState({ transcriptions: [tx1] });

      await useTranscriptionStore
        .getState()
        .deleteTranscriptions(new Set(["tx1", "nonexistent"]));

      // Only tx1 should have been deleted from storage
      expect(storageService.deleteTranscription).toHaveBeenCalledTimes(1);
      expect(storageService.deleteTranscription).toHaveBeenCalledWith("tx1");
      expect(useTranscriptionStore.getState().transcriptions).toHaveLength(0);
    });

    it("handles storage failure during batch delete", async () => {
      const tx1 = makeTx({ id: "tx1" });
      useTranscriptionStore.setState({ transcriptions: [tx1] });
      (storageService.deleteTranscription as jest.Mock).mockRejectedValueOnce(
        new Error("delete fail"),
      );

      await expect(
        useTranscriptionStore.getState().deleteTranscriptions(new Set(["tx1"])),
      ).rejects.toThrow("Failed to delete transcriptions");
    });
  });

  describe("clearTranscriptions - error handling", () => {
    it("throws on storage failure", async () => {
      (storageService.clearTranscriptions as jest.Mock).mockRejectedValueOnce(
        new Error("clear fail"),
      );

      await expect(
        useTranscriptionStore.getState().clearTranscriptions(),
      ).rejects.toThrow("Failed to clear transcriptions");
    });
  });

  describe("deleteAllTranscriptionsForSession - error handling", () => {
    it("throws on storage failure", async () => {
      useTranscriptionStore.setState({ transcriptions: [] });
      (
        storageService.deleteTranscriptionsForSession as jest.Mock
      ).mockRejectedValueOnce(new Error("delete fail"));

      await expect(
        useTranscriptionStore
          .getState()
          .deleteAllTranscriptionsForSession("session-1"),
      ).rejects.toThrow("Failed to delete transcriptions for session");
    });
  });

  describe("cleanupPreviewsForSessionChange - partial mismatch", () => {
    it("clears only livePreview when it mismatches but loadingPreview matches", () => {
      useTranscriptionStore.getState().updateLivePreview("text", "session-1");
      useTranscriptionStore.getState().createLoadingPreview("session-2");

      useTranscriptionStore
        .getState()
        .cleanupPreviewsForSessionChange("session-2");

      expect(useTranscriptionStore.getState().livePreview).toBeNull();
      expect(useTranscriptionStore.getState().loadingPreview).not.toBeNull();
    });

    it("clears only loadingPreview when it mismatches but livePreview matches", () => {
      useTranscriptionStore.getState().updateLivePreview("text", "session-2");
      useTranscriptionStore.getState().createLoadingPreview("session-1");

      useTranscriptionStore
        .getState()
        .cleanupPreviewsForSessionChange("session-2");

      expect(useTranscriptionStore.getState().livePreview).not.toBeNull();
      expect(useTranscriptionStore.getState().loadingPreview).toBeNull();
    });

    it("handles null currentSessionId", () => {
      useTranscriptionStore.getState().updateLivePreview("text", "session-1");

      useTranscriptionStore.getState().cleanupPreviewsForSessionChange(null);

      expect(useTranscriptionStore.getState().livePreview).toBeNull();
    });
  });

  describe("updateTranscription - rollback edge case", () => {
    it("does not rollback when state has been modified by another operation", async () => {
      const tx1 = makeTx({ id: "tx1", text: "Original" });
      useTranscriptionStore.setState({ transcriptions: [tx1] });

      const updated = { ...tx1, text: "Updated" };
      (storageService.saveTranscription as jest.Mock).mockImplementation(
        async () => {
          // Simulate another operation modifying the store during the save
          const currentTxs = useTranscriptionStore.getState().transcriptions;
          const modified = [{ ...currentTxs[0], text: "Concurrent change" }];
          useTranscriptionStore.setState({ transcriptions: modified });
          throw new Error("save fail");
        },
      );

      await expect(
        useTranscriptionStore.getState().updateTranscription(updated),
      ).rejects.toThrow("Failed to update transcription");

      // Should NOT have rolled back since the transcription at index 0 is not the 'updated' object
      expect(useTranscriptionStore.getState().transcriptions[0].text).toBe(
        "Concurrent change",
      );
    });
  });

  describe("validateStateTransition edge cases", () => {
    it("STREAMING -> STREAMING is not valid", () => {
      useTranscriptionStore.getState().transitionTo(TranscriptionState.READY);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.RECORDING_STARTING);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.RECORDING);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.STREAMING);
      expect(
        useTranscriptionStore
          .getState()
          .transitionTo(TranscriptionState.STREAMING),
      ).toBe(false);
    });

    it("TRANSCRIBING -> RECORDING is not valid", () => {
      useTranscriptionStore.getState().transitionTo(TranscriptionState.READY);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.RECORDING_STARTING);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.RECORDING);
      useTranscriptionStore
        .getState()
        .transitionTo(TranscriptionState.TRANSCRIBING);
      expect(
        useTranscriptionStore
          .getState()
          .transitionTo(TranscriptionState.RECORDING),
      ).toBe(false);
    });

    it("READY -> STREAMING is not valid", () => {
      useTranscriptionStore.getState().transitionTo(TranscriptionState.READY);
      expect(
        useTranscriptionStore
          .getState()
          .transitionTo(TranscriptionState.STREAMING),
      ).toBe(false);
    });

    it("ERROR -> RECORDING is not valid", () => {
      useTranscriptionStore.getState().transitionTo(TranscriptionState.ERROR);
      expect(
        useTranscriptionStore
          .getState()
          .transitionTo(TranscriptionState.RECORDING),
      ).toBe(false);
    });
  });

  describe("startRecording - ERROR state transition to READY fails", () => {
    it("returns false when ERROR -> READY transition is blocked", async () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.ERROR,
        isEngineReady: true,
        isOperationLocked: false,
        lastOperationTime: null,
      });

      // Mock transitionTo to fail for READY transition
      const origTransitionTo = useTranscriptionStore.getState().transitionTo;
      let callCount = 0;
      useTranscriptionStore.setState({
        transitionTo: (newState: TranscriptionState, errorMessage?: string) => {
          callCount++;
          if (callCount === 1 && newState === TranscriptionState.READY) {
            return false;
          }
          return origTransitionTo(newState, errorMessage);
        },
      });

      const result = await useTranscriptionStore.getState().startRecording();
      expect(result).toBe(false);
    });
  });

  describe("getLivePreviewForSession / getLoadingPreviewForSession - null cases", () => {
    it("getLivePreviewForSession returns null for null sessionId when preview exists", () => {
      useTranscriptionStore.getState().updateLivePreview("text", "session-1");
      expect(
        useTranscriptionStore.getState().getLivePreviewForSession(null),
      ).toBeNull();
    });

    it("getLoadingPreviewForSession returns null for null sessionId when preview exists", () => {
      useTranscriptionStore.getState().createLoadingPreview("session-1");
      expect(
        useTranscriptionStore.getState().getLoadingPreviewForSession(null),
      ).toBeNull();
    });
  });

  describe("isStreaming / isLoading - negative cases", () => {
    it("isStreaming returns false in READY state", () => {
      useTranscriptionStore.setState({ state: TranscriptionState.READY });
      expect(useTranscriptionStore.getState().isStreaming()).toBe(false);
    });

    it("isLoading returns false in READY state", () => {
      useTranscriptionStore.setState({ state: TranscriptionState.READY });
      expect(useTranscriptionStore.getState().isLoading()).toBe(false);
    });

    it("isModelReady returns false in LOADING state", () => {
      expect(useTranscriptionStore.getState().isModelReady()).toBe(false);
    });

    it("isTranscribing returns false in READY state", () => {
      useTranscriptionStore.setState({ state: TranscriptionState.READY });
      expect(useTranscriptionStore.getState().isTranscribing()).toBe(false);
    });

    it("isRecording returns false in READY state", () => {
      useTranscriptionStore.setState({ state: TranscriptionState.READY });
      expect(useTranscriptionStore.getState().isRecording()).toBe(false);
    });
  });

  describe("smart split chunk handling", () => {
    const primeRealtimeSession = async () => {
      useTranscriptionStore.setState({
        state: TranscriptionState.READY,
        isEngineReady: true,
        isOperationLocked: false,
        lastOperationTime: null,
      });
      useSettingsStore.setState({
        selectedModelType: ModelType.WHISPER_REALTIME,
        selectedTranscriptionMode: TranscriptionMode.REALTIME,
      });
      // Run the real startRecording so subscribeToChunk / subscribeToAudioLevel
      // callbacks installed by the store are covered when we emit events.
      await useTranscriptionStore.getState().startRecording();
    };

    it("propagates audio level updates from the sherpa subscription", async () => {
      await primeRealtimeSession();
      expect(capturedAudioLevelCallback).toBeDefined();
      capturedAudioLevelCallback?.(0.42);
      expect(useTranscriptionStore.getState().audioLevel).toBe(0.42);
    });

    it("long-pause boundary below the 60s cap keeps text in one item", async () => {
      await primeRealtimeSession();

      emitChunk({ text: "Thought one.", boundary: "long" });
      emitChunk({ text: "Thought two.", boundary: "final" });

      const txs = useTranscriptionStore.getState().transcriptions;
      expect(txs).toHaveLength(1);
      expect(txs[0].text).toBe("Thought one. Thought two.");
    });

    it("final boundary on empty buffer does not create a transcription", async () => {
      await primeRealtimeSession();

      emitChunk({ text: "", boundary: "final" });

      expect(useTranscriptionStore.getState().transcriptions).toHaveLength(0);
      expect(storageService.saveTranscription).not.toHaveBeenCalled();
    });

    it("final boundary on whitespace-only buffer resets state without persisting", async () => {
      await primeRealtimeSession();

      emitChunk({ text: "   ", boundary: "final" });

      const state = useTranscriptionStore.getState();
      expect(state.transcriptions).toHaveLength(0);
      expect(state.smartSplit.currentItemId).toBeNull();
      expect(state.smartSplit.currentItemText).toBe("");
      expect(storageService.saveTranscription).not.toHaveBeenCalled();
    });

    it("none boundary keeps accumulating text with a space separator", async () => {
      await primeRealtimeSession();

      emitChunk({ text: "alpha", boundary: "none" });
      emitChunk({ text: "beta", boundary: "none" });

      expect(useTranscriptionStore.getState().smartSplit.currentItemText).toBe(
        "alpha beta",
      );
      expect(useTranscriptionStore.getState().transcriptions).toHaveLength(0);
    });

    it("smart split disabled: long pause past 60s does NOT finalize", async () => {
      useSettingsStore.setState({ smartSplitEnabled: false });
      await primeRealtimeSession();

      const dateSpy = jest.spyOn(Date, "now");
      dateSpy.mockReturnValue(1_000_000);
      emitChunk({ text: "Long speech.", boundary: "none" });
      dateSpy.mockReturnValue(1_000_000 + 61_000);
      emitChunk({ text: "", boundary: "long" });
      emitChunk({ text: "Still the same item.", boundary: "final" });

      dateSpy.mockRestore();

      const txs = useTranscriptionStore.getState().transcriptions;
      expect(txs).toHaveLength(1);
      expect(txs[0].text).toBe("Long speech. Still the same item.");
    });

    it("60s rule: long pause on an item older than the max forces a split", async () => {
      await primeRealtimeSession();
      (Crypto.randomUUID as jest.Mock)
        .mockReturnValueOnce("id-long")
        .mockReturnValueOnce("id-next");

      const dateSpy = jest.spyOn(Date, "now");
      dateSpy.mockReturnValue(1_000_000);
      emitChunk({ text: "Long speech.", boundary: "none" });
      dateSpy.mockReturnValue(1_000_000 + 61_000);
      emitChunk({ text: "", boundary: "long" });
      emitChunk({ text: "Next one.", boundary: "final" });

      dateSpy.mockRestore();

      const txs = useTranscriptionStore.getState().transcriptions;
      expect(txs).toHaveLength(2);
      expect(txs[0].id).toBe("id-long");
      expect(txs[0].text).toBe("Long speech.");
      expect(txs[1].id).toBe("id-next");
      expect(txs[1].text).toBe("Next one.");
    });

    it("queues storage writes sequentially across multiple finalized items", async () => {
      await primeRealtimeSession();
      (Crypto.randomUUID as jest.Mock)
        .mockReturnValueOnce("id-q1")
        .mockReturnValueOnce("id-q2")
        .mockReturnValueOnce("id-q3");

      // Advance the clock past the 60s cap between each chunk so the long
      // pause actually finalizes — otherwise everything collapses into one.
      const dateSpy = jest.spyOn(Date, "now");
      dateSpy.mockReturnValue(1_000_000);
      emitChunk({ text: "A.", boundary: "none" });
      dateSpy.mockReturnValue(1_000_000 + 61_000);
      emitChunk({ text: "", boundary: "long" });
      emitChunk({ text: "B.", boundary: "none" });
      dateSpy.mockReturnValue(1_000_000 + 2 * 61_000);
      emitChunk({ text: "", boundary: "long" });
      emitChunk({ text: "C.", boundary: "final" });
      dateSpy.mockRestore();

      // Flush the queued saves.
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(storageService.saveTranscription).toHaveBeenCalledTimes(3);
      const calledIds = (
        storageService.saveTranscription as jest.Mock
      ).mock.calls.map(([t]) => t.id);
      expect(calledIds).toEqual(["id-q1", "id-q2", "id-q3"]);
    });

    it("incognito: chunks appear in-memory but skip storage writes", async () => {
      useSessionStore.setState({
        activeSessionId: "inc",
        incognitoSession: {
          id: "inc",
          name: "Incognito",
          timestamp: new Date(),
          lastModified: new Date(),
          isIncognito: true,
        },
      });
      useTranscriptionStore.setState({
        state: TranscriptionState.READY,
        isEngineReady: true,
      });
      useSettingsStore.setState({
        selectedTranscriptionMode: TranscriptionMode.REALTIME,
      });
      await useTranscriptionStore.getState().startRecording();

      emitChunk({ text: "Secret.", boundary: "final" });

      expect(useTranscriptionStore.getState().transcriptions).toHaveLength(1);
      expect(storageService.saveTranscription).not.toHaveBeenCalled();
    });
  });
});
