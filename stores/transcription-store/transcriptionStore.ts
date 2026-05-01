import * as Crypto from "expo-crypto";
import { File, Paths } from "expo-file-system";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useMemo } from "react";
import { AppState } from "react-native";
import { create } from "zustand";
import { useShallow } from "zustand/shallow";

import { AppConstants } from "@/constants";
import { Transcription, TranscriptionMode, TranscriptionState } from "@/models";
import type { ChunkEvent } from "@/services";
import {
  backgroundRecordingService,
  sherpaTranscriptionService,
  storageService,
} from "@/services";
import {
  FeatureFlag,
  formatTranscriptionText,
  logError,
  logWarn,
} from "@/utils";

import { useSessionStore } from "../session-store/sessionStore";
import { useSettingsStore } from "../settings-store/settingsStore";
import { useUIStore } from "../ui-store/uiStore";

const MINIMUM_OPERATION_INTERVAL = 500;
const OPERATION_TIMEOUT = 30000;

interface SmartSplitState {
  /** ID of the in-progress item, or null if no text has landed yet. */
  currentItemId: string | null;
  /** Accumulated text for the in-progress item. */
  currentItemText: string;
  /** Wall time (ms since epoch) when the current item started collecting text. */
  currentItemStartMs: number;
  /** Items finalized during the active recording, in order. */
  createdTranscriptions: Transcription[];
  /**
   * When true (file mode), the chunk handler skips storage writes. The caller
   * inspects `createdTranscriptions` after the scan and persists in one pass.
   */
  deferPersist: boolean;
}

const createEmptySmartSplit = (): SmartSplitState => ({
  currentItemId: null,
  currentItemText: "",
  currentItemStartMs: 0,
  createdTranscriptions: [],
  deferPersist: false,
});

const insertSortedTranscription = (
  list: Transcription[],
  t: Transcription,
): Transcription[] => {
  // Items typically arrive in chronological order — fast-path the common case
  // and fall back to a full sort when something older lands.
  const ts = t.timestamp.getTime();
  if (list.length === 0 || list[list.length - 1].timestamp.getTime() <= ts) {
    return [...list, t];
  }
  const next = [...list, t];
  next.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return next;
};

interface TranscriptionStore {
  state: TranscriptionState;
  errorMessage: string | null;

  currentStreamingText: string;
  livePreview: Transcription | null;
  loadingPreview: Transcription | null;
  recordingSessionId: string | null;
  audioLevel: number;

  transcriptions: Transcription[];
  isLoaded: boolean;
  isInitialized: boolean;
  initError: string | null;
  isEngineReady: boolean;

  isOperationLocked: boolean;
  activeOperations: Set<string>;
  lastOperationTime: Date | null;

  chunkUnsubscribe: (() => void) | null;
  realtimeAudioLevelUnsubscribe: (() => void) | null;

  smartSplit: SmartSplitState;

  isLoading: () => boolean;
  isRecording: () => boolean;
  isTranscribing: () => boolean;
  isModelReady: () => boolean;
  isStreaming: () => boolean;
  getError: () => string | null;
  sessionTranscriptions: (sessionId: string) => Transcription[];
  getLivePreviewForSession: (sessionId: string | null) => Transcription | null;
  getLoadingPreviewForSession: (
    sessionId: string | null,
  ) => Transcription | null;

  transitionTo: (
    newState: TranscriptionState,
    errorMessage?: string,
  ) => boolean;
  setError: (message: string) => void;
  clearError: () => void;

  updateStreamingText: (text: string) => void;
  clearStreamingText: () => void;
  updateLivePreview: (text: string, sessionId: string) => void;
  clearLivePreview: () => void;
  createLoadingPreview: (sessionId: string) => void;
  clearLoadingPreview: () => void;
  setRecordingSessionId: (sessionId: string) => void;
  clearRecordingSessionId: () => void;
  updateAudioLevel: (level: number) => void;
  cleanupPreviewsForSessionChange: (currentSessionId: string | null) => void;

  _loadTranscriptionsInternal: () => Promise<void>;
  loadTranscriptions: () => Promise<void>;
  addTranscription: (transcription: Transcription) => void;
  updateTranscription: (transcription: Transcription) => Promise<void>;
  deleteTranscription: (id: string) => Promise<void>;
  deleteTranscriptions: (ids: Set<string>) => Promise<void>;
  clearTranscriptions: () => Promise<void>;
  deleteParagraphFromTranscription: (
    id: string,
    paragraphIndex: number,
  ) => Promise<void>;
  deleteAllTranscriptionsForSession: (sessionId: string) => Promise<void>;
  cleanupDeletedSessions: (validSessionIds: Set<string>) => Promise<void>;

  startRecording: () => Promise<boolean>;
  stopRecordingAndSave: () => Promise<void>;
  onChunkEvent: (event: ChunkEvent) => void;

  initialize: () => Promise<void>;
  clearErrorState: () => void;
  forceSystemReset: () => Promise<void>;
  dispose: () => Promise<void>;
}

const validateStateTransition = (
  from: TranscriptionState,
  to: TranscriptionState,
): boolean => {
  const validTransitions: Record<TranscriptionState, TranscriptionState[]> = {
    [TranscriptionState.LOADING]: [
      TranscriptionState.READY,
      TranscriptionState.ERROR,
    ],
    [TranscriptionState.READY]: [
      TranscriptionState.RECORDING,
      TranscriptionState.LOADING,
      TranscriptionState.ERROR,
    ],
    [TranscriptionState.RECORDING]: [
      TranscriptionState.TRANSCRIBING,
      TranscriptionState.READY,
      TranscriptionState.ERROR,
      TranscriptionState.STREAMING,
    ],
    [TranscriptionState.STREAMING]: [
      TranscriptionState.TRANSCRIBING,
      TranscriptionState.READY,
      TranscriptionState.ERROR,
    ],
    [TranscriptionState.TRANSCRIBING]: [
      TranscriptionState.READY,
      TranscriptionState.ERROR,
    ],
    [TranscriptionState.ERROR]: [
      TranscriptionState.LOADING,
      TranscriptionState.READY,
    ],
  };

  return validTransitions[from]?.includes(to) ?? false;
};

export const useTranscriptionStore = create<TranscriptionStore>((set, get) => {
  const timeoutIds = new Map<string, ReturnType<typeof setTimeout>>();

  // Serializes storage writes triggered by chunk events so concurrent
  // saveTranscription calls don't stomp on each other's read-modify-write.
  let storageWriteQueue: Promise<void> = Promise.resolve();
  const enqueueStorageWrite = (op: () => Promise<void>): void => {
    storageWriteQueue = storageWriteQueue.then(op).catch((error) => {
      logError(error, {
        flag: FeatureFlag.store,
        message: "Queued transcription storage write failed",
      });
    });
  };
  const drainStorageWriteQueue = (): Promise<void> => storageWriteQueue;

  const tearDownRealtimeSubscriptions = (): void => {
    const state = get();
    state.chunkUnsubscribe?.();
    state.realtimeAudioLevelUnsubscribe?.();
    set({
      chunkUnsubscribe: null,
      realtimeAudioLevelUnsubscribe: null,
    });
  };

  const persistFileModeItems = async (
    items: Transcription[],
    recordedFileUri: string | null,
    sessionId: string,
  ): Promise<void> => {
    if (items.length === 1 && recordedFileUri) {
      const audioPath = await storageService.saveAudioFile(
        recordedFileUri,
        `audio_${Date.now()}.wav`,
      );
      const updated: Transcription = { ...items[0], audioPath };
      set({
        transcriptions: get().transcriptions.map((t) =>
          t.id === updated.id ? updated : t,
        ),
      });
      await storageService.saveTranscription(updated);
    } else {
      for (const t of items) {
        await storageService.saveTranscription(t);
      }
    }
    await useSessionStore.getState().updateSessionModifiedTimestamp(sessionId);
  };

  const finalizeSmartSplitItem = (): void => {
    const state = get();
    const split = state.smartSplit;

    const sessionId = state.recordingSessionId;
    const trimmed = split.currentItemText.trim();

    if (!split.currentItemId || !trimmed || !sessionId) {
      // Nothing to finalize — reset the in-progress state.
      if (split.currentItemId || split.currentItemText) {
        set({
          smartSplit: {
            ...split,
            currentItemId: null,
            currentItemText: "",
            currentItemStartMs: 0,
          },
        });
      }
      return;
    }

    const transcription: Transcription = {
      id: split.currentItemId,
      sessionId,
      text: formatTranscriptionText(trimmed),
      timestamp: new Date(),
      audioPath: "",
    };

    set({
      transcriptions: insertSortedTranscription(
        state.transcriptions,
        transcription,
      ),
      smartSplit: {
        ...split,
        currentItemId: null,
        currentItemText: "",
        currentItemStartMs: 0,
        createdTranscriptions: [...split.createdTranscriptions, transcription],
      },
      livePreview: null,
    });

    if (split.deferPersist) return;
    if (useSessionStore.getState().isActiveSessionIncognito()) return;

    enqueueStorageWrite(async () => {
      await storageService.saveTranscription(transcription);
      await useSessionStore
        .getState()
        .updateSessionModifiedTimestamp(sessionId);
    });
  };

  const acquireOperationLock = async (
    operationName: string,
  ): Promise<boolean> => {
    const state = get();

    if (state.isOperationLocked) {
      if (
        operationName === "stopRecordingAndSave" &&
        state.state === TranscriptionState.RECORDING
      ) {
        return true;
      }
      return false;
    }

    if (operationName !== "stopRecordingAndSave") {
      const now = new Date();
      if (state.lastOperationTime) {
        const timeSinceLastOperation =
          now.getTime() - state.lastOperationTime.getTime();
        if (timeSinceLastOperation < MINIMUM_OPERATION_INTERVAL) {
          return false;
        }
      }
    }

    const newActiveOps = new Set(state.activeOperations);
    newActiveOps.add(operationName);

    set({
      isOperationLocked: true,
      lastOperationTime: new Date(),
      activeOperations: newActiveOps,
    });

    const timeoutId = setTimeout(() => {
      const currentState = get();
      if (currentState.activeOperations.has(operationName)) {
        releaseOperationLock(operationName);
      }
    }, OPERATION_TIMEOUT);

    timeoutIds.set(operationName, timeoutId);

    return true;
  };

  const releaseOperationLock = (operationName: string) => {
    const timeoutId = timeoutIds.get(operationName);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutIds.delete(operationName);
    }

    const state = get();
    const newActiveOps = new Set(state.activeOperations);
    newActiveOps.delete(operationName);

    set({
      isOperationLocked: false,
      activeOperations: newActiveOps,
    });
  };

  return {
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

    isOperationLocked: false,
    activeOperations: new Set(),
    lastOperationTime: null,

    chunkUnsubscribe: null,
    realtimeAudioLevelUnsubscribe: null,

    smartSplit: createEmptySmartSplit(),

    isLoading: () => get().state === TranscriptionState.LOADING,
    isRecording: () => get().state === TranscriptionState.RECORDING,
    isTranscribing: () => get().state === TranscriptionState.TRANSCRIBING,
    isModelReady: () => get().state === TranscriptionState.READY,
    isStreaming: () =>
      get().state === TranscriptionState.STREAMING ||
      get().state === TranscriptionState.RECORDING,
    getError: () =>
      get().state === TranscriptionState.ERROR ? get().errorMessage : null,

    sessionTranscriptions: (sessionId: string) => {
      const state = get();
      return state.transcriptions.filter((t) => t.sessionId === sessionId);
    },

    getLivePreviewForSession: (sessionId: string | null) => {
      const state = get();
      if (state.livePreview?.sessionId === sessionId) {
        return state.livePreview;
      }
      return null;
    },

    getLoadingPreviewForSession: (sessionId: string | null) => {
      const state = get();
      if (state.loadingPreview?.sessionId === sessionId) {
        return state.loadingPreview;
      }
      return null;
    },

    transitionTo: (newState: TranscriptionState, errorMessage?: string) => {
      const currentState = get().state;

      if (!validateStateTransition(currentState, newState)) {
        logWarn(`Invalid state transition: ${currentState} -> ${newState}`, {
          flag: FeatureFlag.store,
        });
        return false;
      }

      // Keep screen awake during recording/streaming/transcribing
      const keepAwakeStates = new Set([
        TranscriptionState.RECORDING,
        TranscriptionState.STREAMING,
        TranscriptionState.TRANSCRIBING,
      ]);
      if (AppState.currentState === "active") {
        if (keepAwakeStates.has(newState)) {
          void activateKeepAwakeAsync("recording").catch(() => {});
        } else if (keepAwakeStates.has(currentState)) {
          void deactivateKeepAwake("recording").catch(() => {});
        }
      }

      set({
        state: newState,
        errorMessage:
          newState === TranscriptionState.ERROR
            ? (errorMessage ?? "Unknown error occurred")
            : null,
      });

      return true;
    },

    setError: (message: string) => {
      get().transitionTo(TranscriptionState.ERROR, message);
    },

    clearError: () => {
      const state = get();
      if (state.state === TranscriptionState.ERROR) {
        set({ errorMessage: null });
        get().transitionTo(TranscriptionState.READY);
      }
    },

    updateStreamingText: (text: string) => {
      set({ currentStreamingText: text });
    },

    clearStreamingText: () => {
      set({ currentStreamingText: "" });
    },

    updateLivePreview: (text: string, sessionId: string) => {
      const existing = get().livePreview;
      if (
        existing &&
        existing.sessionId === sessionId &&
        existing.text === text
      ) {
        return;
      }
      set({
        livePreview: {
          id: "live_active_preview",
          text,
          timestamp: existing?.timestamp ?? new Date(),
          sessionId,
          audioPath: "",
        },
      });
    },

    clearLivePreview: () => {
      if (get().livePreview !== null) {
        set({ livePreview: null });
      }
    },

    createLoadingPreview: (sessionId: string) => {
      set({
        loadingPreview: {
          id: "loading_active_preview",
          text: "",
          timestamp: new Date(),
          sessionId,
          audioPath: "",
        },
      });
    },

    clearLoadingPreview: () => {
      if (get().loadingPreview !== null) {
        set({ loadingPreview: null });
      }
    },

    setRecordingSessionId: (sessionId: string) => {
      set({ recordingSessionId: sessionId });
    },

    clearRecordingSessionId: () => {
      set({ recordingSessionId: null });
    },

    updateAudioLevel: (level: number) => {
      set({ audioLevel: level });
    },

    cleanupPreviewsForSessionChange: (currentSessionId: string | null) => {
      const state = get();
      let changed = false;
      const updates: Partial<TranscriptionStore> = {};

      if (state.livePreview?.sessionId !== currentSessionId) {
        updates.livePreview = null;
        changed = true;
      }

      if (state.loadingPreview?.sessionId !== currentSessionId) {
        updates.loadingPreview = null;
        changed = true;
      }

      if (changed) {
        set(updates);
      }
    },

    _loadTranscriptionsInternal: async () => {
      const transcriptions = await storageService.getTranscriptions();
      transcriptions.sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      );

      set({
        transcriptions,
        isLoaded: true,
      });
    },

    loadTranscriptions: async () => {
      const operationName = "loadTranscriptions";

      if (!(await acquireOperationLock(operationName))) {
        throw new Error("Cannot load transcriptions - system is busy");
      }

      try {
        await get()._loadTranscriptionsInternal();
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.store,
          message: "Failed to load transcriptions",
        });
        throw error;
      } finally {
        releaseOperationLock(operationName);
      }
    },

    addTranscription: (transcription: Transcription) => {
      set({
        transcriptions: insertSortedTranscription(
          get().transcriptions,
          transcription,
        ),
      });
    },

    updateTranscription: async (updated: Transcription) => {
      const state = get();
      const index = state.transcriptions.findIndex((t) => t.id === updated.id);

      if (index === -1) {
        throw new Error("Transcription not found");
      }

      const previous = state.transcriptions[index];
      const newTranscriptions = [...state.transcriptions];
      newTranscriptions[index] = updated;

      set({ transcriptions: newTranscriptions });

      try {
        await storageService.saveTranscription(updated);
        await useSessionStore
          .getState()
          .updateSessionModifiedTimestamp(updated.sessionId);
      } catch (error) {
        const current = get().transcriptions;
        if (current[index] === updated) {
          const rollback = [...current];
          rollback[index] = previous;
          set({ transcriptions: rollback });
        }
        logError(error, {
          flag: FeatureFlag.store,
          message: "Failed to update transcription",
        });
        throw new Error(`Failed to update transcription: ${error}`);
      }
    },

    deleteTranscription: async (id: string) => {
      try {
        const state = get();
        const transcription = state.transcriptions.find((t) => t.id === id);

        if (!transcription) {
          throw new Error("Transcription not found");
        }

        const sessionId = transcription.sessionId;

        await storageService.deleteTranscription(id);

        const newTranscriptions = state.transcriptions.filter(
          (t) => t.id !== id,
        );
        set({ transcriptions: newTranscriptions });

        await useSessionStore
          .getState()
          .updateSessionModifiedTimestamp(sessionId);
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.store,
          message: "Failed to delete transcription",
        });
        throw new Error(`Failed to delete transcription: ${error}`);
      }
    },

    deleteTranscriptions: async (ids: Set<string>) => {
      try {
        const state = get();
        const sessionIds = new Set<string>();

        for (const id of ids) {
          const transcription = state.transcriptions.find((t) => t.id === id);
          if (transcription) {
            sessionIds.add(transcription.sessionId);
            await storageService.deleteTranscription(id);
          }
        }

        const newTranscriptions = state.transcriptions.filter(
          (t) => !ids.has(t.id),
        );
        set({ transcriptions: newTranscriptions });

        for (const sessionId of sessionIds) {
          await useSessionStore
            .getState()
            .updateSessionModifiedTimestamp(sessionId);
        }
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.store,
          message: "Failed to delete transcriptions",
        });
        throw new Error(`Failed to delete transcriptions: ${error}`);
      }
    },

    clearTranscriptions: async () => {
      try {
        await storageService.clearTranscriptions();
        set({ transcriptions: [], isLoaded: true });
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.store,
          message: "Failed to clear transcriptions",
        });
        throw new Error(`Failed to clear transcriptions: ${error}`);
      }
    },

    deleteParagraphFromTranscription: async (
      id: string,
      paragraphIndex: number,
    ) => {
      try {
        const state = get();
        const transcription = state.transcriptions.find((t) => t.id === id);

        if (!transcription) {
          throw new Error("Transcription not found");
        }

        const paragraphs = transcription.text.split("\n\n");

        if (paragraphIndex < 0 || paragraphIndex >= paragraphs.length) {
          throw new Error("Invalid paragraph index");
        }

        paragraphs.splice(paragraphIndex, 1);
        const newText = paragraphs.join("\n\n");

        const updatedTranscription = {
          ...transcription,
          text: newText,
        };

        if (newText.trim() === "") {
          await get().deleteTranscription(id);
        } else {
          await get().updateTranscription(updatedTranscription);
        }

        await useSessionStore
          .getState()
          .updateSessionModifiedTimestamp(transcription.sessionId);
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.store,
          message: "Failed to delete paragraph from transcription",
        });
        throw new Error(`Failed to delete paragraph: ${error}`);
      }
    },

    deleteAllTranscriptionsForSession: async (sessionId: string) => {
      try {
        const state = get();
        const newTranscriptions = state.transcriptions.filter(
          (t) => t.sessionId !== sessionId,
        );

        await storageService.deleteTranscriptionsForSession(sessionId);

        set({ transcriptions: newTranscriptions });

        await useSessionStore
          .getState()
          .updateSessionModifiedTimestamp(sessionId);
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.store,
          message: "Failed to delete all transcriptions for session",
        });
        throw new Error(
          `Failed to delete transcriptions for session: ${error}`,
        );
      }
    },

    cleanupDeletedSessions: async (validSessionIds: Set<string>) => {
      const state = get();
      const inMemorySessionIds = new Set(
        state.transcriptions.map((t) => t.sessionId),
      );
      const sessionsToDelete = [...inMemorySessionIds].filter(
        (id) => !validSessionIds.has(id),
      );

      if (sessionsToDelete.length === 0) {
        return;
      }

      for (const sessionId of sessionsToDelete) {
        if (sessionId.trim() === "") continue;
        await storageService.deleteTranscriptionsForSession(sessionId);
      }

      const newTranscriptions = state.transcriptions.filter((t) =>
        validSessionIds.has(t.sessionId),
      );

      set({ transcriptions: newTranscriptions });
    },

    startRecording: async () => {
      const operationName = "startRecording";

      if (!(await acquireOperationLock(operationName))) {
        return false;
      }

      try {
        const state = get();
        const currentState = state.state;

        if (
          currentState !== TranscriptionState.READY &&
          currentState !== TranscriptionState.ERROR
        ) {
          releaseOperationLock(operationName);
          return false;
        }

        if (currentState === TranscriptionState.ERROR) {
          if (!get().transitionTo(TranscriptionState.READY)) {
            releaseOperationLock(operationName);
            return false;
          }
        }

        // Get settings for model and language
        const settingsState = useSettingsStore.getState();
        const transcriptionMode = settingsState.selectedTranscriptionMode;
        const modelId = settingsState.selectedModelId;
        const languageCode = settingsState.selectedLanguage?.code ?? "en";
        const isRealtime = transcriptionMode === TranscriptionMode.REALTIME;

        // Ensure transcription engine is initialized with the right model and language
        const initialized = await sherpaTranscriptionService.initialize(
          modelId,
          languageCode,
        );
        if (!initialized) {
          get().setError("Failed to initialize transcription engine");
          releaseOperationLock(operationName);
          return false;
        }
        set({ isEngineReady: true });

        if (!get().transitionTo(TranscriptionState.RECORDING)) {
          releaseOperationLock(operationName);
          return false;
        }

        const sessionId = useSessionStore.getState().activeSessionId;
        get().setRecordingSessionId(sessionId);

        get().clearLivePreview();
        get().clearLoadingPreview();

        let bgServiceStarted = false;
        const bgStarted =
          await backgroundRecordingService.startBackgroundService();
        if (!bgStarted) {
          logWarn(
            "Background service failed to start, recording may stop in background",
            {
              flag: FeatureFlag.service,
            },
          );
        } else {
          bgServiceStarted = true;
        }

        // File-mode defers per-chunk persistence so stopRecordingAndSave can
        // save items in one pass and attach a WAV to the single-item case.
        set({
          smartSplit: { ...createEmptySmartSplit(), deferPersist: !isRealtime },
        });
        const unsubscribeChunk = sherpaTranscriptionService.subscribeToChunk(
          (event) => {
            get().onChunkEvent(event);
          },
        );
        set({ chunkUnsubscribe: unsubscribeChunk });

        const unsubscribeAudioLevel =
          sherpaTranscriptionService.subscribeToAudioLevel((level) => {
            get().updateAudioLevel(level);
          });
        set({ realtimeAudioLevelUnsubscribe: unsubscribeAudioLevel });

        const wavOutputUri = isRealtime
          ? undefined
          : new File(Paths.cache, `rec_${Date.now()}.wav`).uri;

        const captureStarted =
          await sherpaTranscriptionService.startRealtimeTranscription(
            wavOutputUri ? { wavOutputUri } : {},
          );

        if (!captureStarted) {
          tearDownRealtimeSubscriptions();
          if (bgServiceStarted) {
            try {
              await backgroundRecordingService.stopBackgroundService();
            } catch (bgError) {
              logError(bgError, {
                flag: FeatureFlag.service,
                message:
                  "Failed to stop background service after capture start failure",
              });
            }
          }
          get().transitionTo(TranscriptionState.READY);
          get().clearRecordingSessionId();
          get().setError(
            isRealtime
              ? "Failed to start real-time transcription"
              : "Failed to start recording",
          );
          releaseOperationLock(operationName);
          return false;
        }

        if (isRealtime) {
          get().updateLivePreview("", sessionId);
        } else {
          get().createLoadingPreview(sessionId);
        }

        return true;
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.recording,
          message: "Error starting recording",
        });
        tearDownRealtimeSubscriptions();
        try {
          await backgroundRecordingService.stopBackgroundService();
        } catch (bgError) {
          logError(bgError, {
            flag: FeatureFlag.service,
            message: "Failed to stop background service during error cleanup",
          });
        }
        get().setError(`Error starting recording: ${error}`);
        get().clearRecordingSessionId();
        return false;
      } finally {
        releaseOperationLock(operationName);
      }
    },

    stopRecordingAndSave: async () => {
      const operationName = "stopRecordingAndSave";

      if (!get().isRecording()) {
        return;
      }

      if (!(await acquireOperationLock(operationName))) {
        get().setError("Cannot stop recording - system is busy");
        return;
      }

      const state = get();
      const sessionId = state.recordingSessionId;
      const settingsState = useSettingsStore.getState();
      const transcriptionMode = settingsState.selectedTranscriptionMode;
      const isRealtime = transcriptionMode === TranscriptionMode.REALTIME;
      const isIncognito = useSessionStore.getState().isActiveSessionIncognito();

      try {
        if (!get().transitionTo(TranscriptionState.TRANSCRIBING)) {
          releaseOperationLock(operationName);
          return;
        }

        const recordedFileUri =
          await sherpaTranscriptionService.stopRealtimeTranscription();
        tearDownRealtimeSubscriptions();

        let producedTranscription = false;

        if (isRealtime) {
          await drainStorageWriteQueue();
          producedTranscription =
            get().smartSplit.createdTranscriptions.length > 0;
        } else {
          const createdItems = get().smartSplit.createdTranscriptions;

          if (createdItems.length === 0) {
            get().setError("Recording was too short or failed");
            get().clearLivePreview();
            get().clearLoadingPreview();
            get().transitionTo(TranscriptionState.READY);
            releaseOperationLock(operationName);
            return;
          }

          const canPersist = !isIncognito && sessionId;
          if (canPersist) {
            await persistFileModeItems(
              createdItems,
              recordedFileUri,
              sessionId,
            );
          }
          producedTranscription = true;
        }

        set({
          livePreview: null,
          loadingPreview: null,
          currentStreamingText: "",
          smartSplit: createEmptySmartSplit(),
        });
        get().transitionTo(TranscriptionState.READY);

        if (
          producedTranscription &&
          !useSettingsStore.getState().hasSeenKeyboardPrompt
        ) {
          useUIStore.getState().showKeyboardPrompt();
        }
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.recording,
          message: "Error stopping recording",
        });
        get().setError(`Error stopping recording: ${error}`);

        get().clearLivePreview();
        get().clearLoadingPreview();

        // Try to recover to ready state
        try {
          get().transitionTo(TranscriptionState.READY);
        } catch {
          // Already in error state
        }
      } finally {
        try {
          await backgroundRecordingService.stopBackgroundService();
        } catch (bgError) {
          logError(bgError, {
            flag: FeatureFlag.service,
            message: "Failed to stop background service",
          });
        }

        get().clearRecordingSessionId();
        releaseOperationLock(operationName);
      }
    },

    onChunkEvent: (event: ChunkEvent) => {
      const { text, boundary } = event;
      const state = get();
      const split = state.smartSplit;

      let currentItemId = split.currentItemId;
      let currentItemText = split.currentItemText;
      let currentItemStartMs = split.currentItemStartMs;

      if (text) {
        if (!currentItemId) {
          currentItemId = Crypto.randomUUID();
          currentItemText = "";
          currentItemStartMs = Date.now();
        }

        const separator = currentItemText ? " " : "";
        currentItemText = currentItemText + separator + text;

        const sessionId =
          state.recordingSessionId ??
          useSessionStore.getState().activeSessionId;
        const canShowPreview =
          !!sessionId &&
          (state.state === TranscriptionState.RECORDING ||
            state.state === TranscriptionState.STREAMING ||
            state.state === TranscriptionState.TRANSCRIBING);

        const nextLivePreview =
          canShowPreview && sessionId
            ? {
                id: "live_active_preview",
                text: currentItemText,
                timestamp: state.livePreview?.timestamp ?? new Date(),
                sessionId,
                audioPath: "",
              }
            : state.livePreview;

        set({
          currentStreamingText: currentItemText,
          smartSplit: {
            ...split,
            currentItemId,
            currentItemText,
            currentItemStartMs,
          },
          livePreview: nextLivePreview,
          loadingPreview: canShowPreview ? null : state.loadingPreview,
        });
      }

      const smartSplitEnabled = useSettingsStore.getState().smartSplitEnabled;
      const itemDurationMs =
        currentItemStartMs > 0 ? Date.now() - currentItemStartMs : 0;
      const exceededMaxDuration =
        currentItemStartMs > 0 &&
        itemDurationMs >= AppConstants.SMART_SPLIT_MAX_ITEM_MS;

      switch (boundary) {
        case "none":
          break;
        case "long":
          if (smartSplitEnabled && exceededMaxDuration) {
            finalizeSmartSplitItem();
          }
          break;
        case "final":
          finalizeSmartSplitItem();
          break;
      }
    },

    initialize: async () => {
      const state = get();

      if (state.isInitialized) {
        logWarn("Transcription store already initialized", {
          flag: FeatureFlag.store,
        });
        return;
      }

      const operationName = "initialization";

      if (!(await acquireOperationLock(operationName))) {
        const error = "System is busy. Please wait and try again.";
        set({ initError: error });
        get().setError(error);
        return;
      }

      try {
        set({
          state: TranscriptionState.LOADING,
          initError: null,
        });

        await get()._loadTranscriptionsInternal();

        // Initialize transcription engine
        const whisperInitialized =
          await sherpaTranscriptionService.initialize();
        if (!whisperInitialized) {
          logWarn(
            `Engine initialization failed: ${sherpaTranscriptionService.initializationStatus}`,
            { flag: FeatureFlag.model },
          );
          set({ isEngineReady: false });
        } else {
          set({ isEngineReady: true });
        }

        get().transitionTo(TranscriptionState.READY);

        set({ isInitialized: true });
      } catch (error) {
        const errorMessage = `Failed to initialize transcription system: ${error}`;
        logError(error, {
          flag: FeatureFlag.store,
          message: "Failed to initialize transcription system",
        });

        set({ initError: errorMessage });
        get().setError(errorMessage);
      } finally {
        releaseOperationLock(operationName);
      }
    },

    clearErrorState: () => {
      const state = get();
      if (state.state === TranscriptionState.ERROR) {
        get().transitionTo(TranscriptionState.READY);
      }
    },

    forceSystemReset: async () => {
      try {
        await sherpaTranscriptionService.stopRealtimeTranscription();
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.transcription,
          message: "Failed to stop realtime transcription during reset",
        });
      }

      tearDownRealtimeSubscriptions();

      try {
        await backgroundRecordingService.stopBackgroundService();
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.service,
          message: "Failed to stop background service during reset",
        });
      }

      set({
        isOperationLocked: false,
        activeOperations: new Set(),
        lastOperationTime: null,
      });

      get().clearRecordingSessionId();
      get().clearLivePreview();
      get().clearLoadingPreview();

      get().transitionTo(TranscriptionState.READY);
    },

    dispose: async () => {
      tearDownRealtimeSubscriptions();

      try {
        await backgroundRecordingService.stopBackgroundService();
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.service,
          message: "Failed to stop background service during dispose",
        });
      }

      await sherpaTranscriptionService.dispose();
    },
  };
});

export const useTranscriptionState = () =>
  useTranscriptionStore((s) => s.state);

export const useSessionTranscriptions = (sessionId?: string) => {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const finalSessionId = sessionId ?? activeSessionId;
  const transcriptions = useTranscriptionStore(
    useShallow((s) => s.transcriptions),
  );

  return useMemo(
    () => transcriptions.filter((t) => t.sessionId === finalSessionId),
    [transcriptions, finalSessionId],
  );
};

export const useIsRecording = () =>
  useTranscriptionStore((s) => s.isRecording());
export const useAudioLevel = () => useTranscriptionStore((s) => s.audioLevel);
export const useStartRecording = () =>
  useTranscriptionStore((s) => s.startRecording);
export const useStopRecordingAndSave = () =>
  useTranscriptionStore((s) => s.stopRecordingAndSave);
export const useDeleteTranscriptions = () =>
  useTranscriptionStore((s) => s.deleteTranscriptions);
export const useLivePreview = () => useTranscriptionStore((s) => s.livePreview);

export const initializeTranscriptionStore = async () => {
  return useTranscriptionStore.getState().initialize();
};

export default useTranscriptionStore;
