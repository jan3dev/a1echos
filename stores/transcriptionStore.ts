import * as Crypto from 'expo-crypto';
import { useMemo } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';

import { ModelType, Transcription, TranscriptionState } from '@/models';
import { audioService, storageService, whisperService } from '@/services';
import { useSessionStore, useSettingsStore } from '@/stores';
import {
  FeatureFlag,
  formatTranscriptionText,
  logError,
  logWarn,
} from '@/utils';

const MINIMUM_OPERATION_INTERVAL = 500;
const OPERATION_TIMEOUT = 30000;

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
  isWhisperReady: boolean;

  isOperationLocked: boolean;
  activeOperations: Set<string>;
  lastOperationTime: Date | null;

  audioLevelUnsubscribe: (() => void) | null;
  partialResultUnsubscribe: (() => void) | null;
  realtimeAudioLevelUnsubscribe: (() => void) | null;

  isLoading: () => boolean;
  isRecording: () => boolean;
  isTranscribing: () => boolean;
  isModelReady: () => boolean;
  isStreaming: () => boolean;
  getError: () => string | null;
  sessionTranscriptions: (sessionId: string) => Transcription[];
  getLivePreviewForSession: (sessionId: string | null) => Transcription | null;
  getLoadingPreviewForSession: (
    sessionId: string | null
  ) => Transcription | null;

  transitionTo: (
    newState: TranscriptionState,
    errorMessage?: string
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
    paragraphIndex: number
  ) => Promise<void>;
  deleteAllTranscriptionsForSession: (sessionId: string) => Promise<void>;
  cleanupDeletedSessions: (validSessionIds: Set<string>) => Promise<void>;

  startRecording: () => Promise<boolean>;
  stopRecordingAndSave: () => Promise<void>;
  onPartialTranscription: (partial: string) => void;

  initialize: () => Promise<void>;
  clearErrorState: () => void;
  forceSystemReset: () => Promise<void>;
  dispose: () => Promise<void>;
}

const validateStateTransition = (
  from: TranscriptionState,
  to: TranscriptionState
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

  const acquireOperationLock = async (
    operationName: string
  ): Promise<boolean> => {
    const state = get();

    if (state.isOperationLocked) {
      if (
        operationName === 'stopRecordingAndSave' &&
        state.state === TranscriptionState.RECORDING
      ) {
        return true;
      }
      return false;
    }

    if (operationName !== 'stopRecordingAndSave') {
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

    currentStreamingText: '',
    livePreview: null,
    loadingPreview: null,
    recordingSessionId: null,
    audioLevel: 0,

    transcriptions: [],
    isLoaded: false,
    isInitialized: false,
    initError: null,
    isWhisperReady: false,

    isOperationLocked: false,
    activeOperations: new Set(),
    lastOperationTime: null,

    audioLevelUnsubscribe: null,
    partialResultUnsubscribe: null,
    realtimeAudioLevelUnsubscribe: null,

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

      set({
        state: newState,
        errorMessage:
          newState === TranscriptionState.ERROR
            ? errorMessage ?? 'Unknown error occurred'
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
      set({ currentStreamingText: '' });
    },

    updateLivePreview: (text: string, sessionId: string) => {
      set({
        livePreview: {
          id: 'live_vosk_active_preview',
          text,
          timestamp: new Date(),
          sessionId,
          audioPath: '',
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
          id: 'whisper_loading_active_preview',
          text: '',
          timestamp: new Date(),
          sessionId,
          audioPath: '',
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
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );

      set({
        transcriptions,
        isLoaded: true,
      });
    },

    loadTranscriptions: async () => {
      const operationName = 'loadTranscriptions';

      if (!(await acquireOperationLock(operationName))) {
        throw new Error('Cannot load transcriptions - system is busy');
      }

      try {
        await get()._loadTranscriptionsInternal();
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.store,
          message: 'Failed to load transcriptions',
        });
        throw error;
      } finally {
        releaseOperationLock(operationName);
      }
    },

    addTranscription: (transcription: Transcription) => {
      const state = get();
      const newTranscriptions = [...state.transcriptions, transcription];
      newTranscriptions.sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );

      set({ transcriptions: newTranscriptions });
    },

    updateTranscription: async (updated: Transcription) => {
      try {
        const state = get();
        const index = state.transcriptions.findIndex(
          (t) => t.id === updated.id
        );

        if (index === -1) {
          throw new Error('Transcription not found');
        }

        const newTranscriptions = [...state.transcriptions];
        newTranscriptions[index] = updated;

        await storageService.saveTranscription(updated);
        await useSessionStore
          .getState()
          .updateSessionModifiedTimestamp(updated.sessionId);

        set({ transcriptions: newTranscriptions });
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.store,
          message: 'Failed to update transcription',
        });
        throw new Error(`Failed to update transcription: ${error}`);
      }
    },

    deleteTranscription: async (id: string) => {
      try {
        const state = get();
        const transcription = state.transcriptions.find((t) => t.id === id);

        if (!transcription) {
          throw new Error('Transcription not found');
        }

        const sessionId = transcription.sessionId;

        await storageService.deleteTranscription(id);

        const newTranscriptions = state.transcriptions.filter(
          (t) => t.id !== id
        );
        set({ transcriptions: newTranscriptions });

        await useSessionStore
          .getState()
          .updateSessionModifiedTimestamp(sessionId);
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.store,
          message: 'Failed to delete transcription',
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
          (t) => !ids.has(t.id)
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
          message: 'Failed to delete transcriptions',
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
          message: 'Failed to clear transcriptions',
        });
        throw new Error(`Failed to clear transcriptions: ${error}`);
      }
    },

    deleteParagraphFromTranscription: async (
      id: string,
      paragraphIndex: number
    ) => {
      try {
        const state = get();
        const transcription = state.transcriptions.find((t) => t.id === id);

        if (!transcription) {
          throw new Error('Transcription not found');
        }

        const paragraphs = transcription.text.split('\n\n');

        if (paragraphIndex < 0 || paragraphIndex >= paragraphs.length) {
          throw new Error('Invalid paragraph index');
        }

        paragraphs.splice(paragraphIndex, 1);
        const newText = paragraphs.join('\n\n');

        const updatedTranscription = {
          ...transcription,
          text: newText,
        };

        if (newText.trim() === '') {
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
          message: 'Failed to delete paragraph from transcription',
        });
        throw new Error(`Failed to delete paragraph: ${error}`);
      }
    },

    deleteAllTranscriptionsForSession: async (sessionId: string) => {
      try {
        const state = get();
        const newTranscriptions = state.transcriptions.filter(
          (t) => t.sessionId !== sessionId
        );

        await storageService.deleteTranscriptionsForSession(sessionId);

        set({ transcriptions: newTranscriptions });

        await useSessionStore
          .getState()
          .updateSessionModifiedTimestamp(sessionId);
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.store,
          message: 'Failed to delete all transcriptions for session',
        });
        throw new Error(
          `Failed to delete transcriptions for session: ${error}`
        );
      }
    },

    cleanupDeletedSessions: async (validSessionIds: Set<string>) => {
      const state = get();
      const inMemorySessionIds = new Set(
        state.transcriptions.map((t) => t.sessionId)
      );
      const sessionsToDelete = [...inMemorySessionIds].filter(
        (id) => !validSessionIds.has(id)
      );

      if (sessionsToDelete.length === 0) {
        return;
      }

      for (const sessionId of sessionsToDelete) {
        if (sessionId.trim() === '') continue;
        await storageService.deleteTranscriptionsForSession(sessionId);
      }

      const newTranscriptions = state.transcriptions.filter((t) =>
        validSessionIds.has(t.sessionId)
      );

      set({ transcriptions: newTranscriptions });
    },

    startRecording: async () => {
      const operationName = 'startRecording';

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

        // Get settings for model type and language
        const settingsState = useSettingsStore.getState();
        const modelType = settingsState.selectedModelType;
        const languageCode = settingsState.selectedLanguage?.code;
        const isRealtime = modelType === ModelType.WHISPER_REALTIME;

        // Ensure Whisper is initialized
        if (!state.isWhisperReady) {
          const initialized = await whisperService.initialize();
          if (!initialized) {
            get().setError('Failed to initialize transcription engine');
            releaseOperationLock(operationName);
            return false;
          }
          set({ isWhisperReady: true });
        }

        if (!get().transitionTo(TranscriptionState.RECORDING)) {
          releaseOperationLock(operationName);
          return false;
        }

        const sessionId = useSessionStore.getState().activeSessionId;
        get().setRecordingSessionId(sessionId);

        get().clearLivePreview();
        get().clearLoadingPreview();

        if (isRealtime) {
          // Subscribe to audio levels BEFORE starting (so callback is ready when data flows)
          const unsubscribeAudioLevel = whisperService.subscribeToAudioLevel(
            (level) => {
              get().updateAudioLevel(level);
            }
          );
          set({ realtimeAudioLevelUnsubscribe: unsubscribeAudioLevel });

          // Subscribe to partial results
          const unsubscribe = whisperService.subscribeToPartialResults(
            (partial) => {
              get().onPartialTranscription(partial);
            }
          );
          set({ partialResultUnsubscribe: unsubscribe });

          // Real-time mode: start Whisper real-time transcription
          const realtimeStarted =
            await whisperService.startRealtimeTranscription(languageCode);
          if (!realtimeStarted) {
            // Cleanup subscriptions on failure
            unsubscribeAudioLevel();
            unsubscribe();
            set({
              realtimeAudioLevelUnsubscribe: null,
              partialResultUnsubscribe: null,
            });
            get().transitionTo(TranscriptionState.READY);
            get().clearRecordingSessionId();
            get().setError('Failed to start real-time transcription');
            releaseOperationLock(operationName);
            return false;
          }
        } else {
          // File-based mode: start audio recording and show loading preview
          const recordingStarted = await audioService.startRecording();
          if (!recordingStarted) {
            get().transitionTo(TranscriptionState.READY);
            get().clearRecordingSessionId();
            get().setError('Failed to start recording');
            releaseOperationLock(operationName);
            return false;
          }

          // Create loading preview for file-based mode
          get().createLoadingPreview(sessionId);
        }

        return true;
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.recording,
          message: 'Error starting recording',
        });
        // Clean up any subscriptions that may have been set before the error
        const currentState = get();
        if (currentState.realtimeAudioLevelUnsubscribe) {
          currentState.realtimeAudioLevelUnsubscribe();
          set({ realtimeAudioLevelUnsubscribe: null });
        }
        if (currentState.partialResultUnsubscribe) {
          currentState.partialResultUnsubscribe();
          set({ partialResultUnsubscribe: null });
        }
        get().setError(`Error starting recording: ${error}`);
        get().clearRecordingSessionId();
        return false;
      } finally {
        releaseOperationLock(operationName);
      }
    },

    stopRecordingAndSave: async () => {
      const operationName = 'stopRecordingAndSave';

      if (!get().isRecording()) {
        return;
      }

      if (!(await acquireOperationLock(operationName))) {
        get().setError('Cannot stop recording - system is busy');
        return;
      }

      const state = get();
      const sessionId = state.recordingSessionId;
      const settingsState = useSettingsStore.getState();
      const modelType = settingsState.selectedModelType;
      const languageCode = settingsState.selectedLanguage?.code;
      const isRealtime = modelType === ModelType.WHISPER_REALTIME;
      const isIncognito = useSessionStore.getState().isActiveSessionIncognito();

      try {
        if (!get().transitionTo(TranscriptionState.TRANSCRIBING)) {
          releaseOperationLock(operationName);
          return;
        }

        let transcribedText: string | null = null;
        let audioPath: string = '';

        if (isRealtime) {
          // Real-time mode: stop Whisper and get final text
          transcribedText = await whisperService.stopRealtimeTranscription();

          // Clean up partial result subscription
          if (state.partialResultUnsubscribe) {
            state.partialResultUnsubscribe();
            set({ partialResultUnsubscribe: null });
          }

          // Clean up realtime audio level subscription
          if (state.realtimeAudioLevelUnsubscribe) {
            state.realtimeAudioLevelUnsubscribe();
            set({ realtimeAudioLevelUnsubscribe: null });
          }
        } else {
          // File-based mode: stop recording and transcribe
          const recordedFilePath = await audioService.stopRecording();

          if (!recordedFilePath) {
            get().setError('Recording was too short or failed');
            get().clearLivePreview();
            get().clearLoadingPreview();
            get().transitionTo(TranscriptionState.READY);
            releaseOperationLock(operationName);
            return;
          }

          // Save audio file to app's audio directory (preserve original extension)
          const lastDotIndex = recordedFilePath.lastIndexOf('.');
          const lastSlashIndex = Math.max(
            recordedFilePath.lastIndexOf('/'),
            recordedFilePath.lastIndexOf('\\')
          );
          const hasValidExtension =
            lastDotIndex > lastSlashIndex && lastDotIndex !== -1;
          const originalExt = hasValidExtension
            ? recordedFilePath.substring(lastDotIndex)
            : '.wav';
          const fileName = `audio_${Date.now()}${originalExt}`;
          audioPath = await storageService.saveAudioFile(
            recordedFilePath,
            fileName
          );

          // Transcribe the audio file
          transcribedText = await whisperService.transcribeFile(
            audioPath,
            languageCode
          );
        }

        // Create and save transcription if we have text
        if (transcribedText && transcribedText.trim() && sessionId) {
          const formattedText = formatTranscriptionText(transcribedText.trim());
          const transcription: Transcription = {
            id: Crypto.randomUUID(),
            sessionId,
            text: formattedText,
            timestamp: new Date(),
            audioPath,
          };

          // Clear previews and add transcription atomically to avoid glitch
          const currentState = get();
          const newTranscriptions = [
            ...currentState.transcriptions,
            transcription,
          ];
          newTranscriptions.sort(
            (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
          );
          set({
            transcriptions: newTranscriptions,
            livePreview: null,
            loadingPreview: null,
            currentStreamingText: '',
          });
          get().transitionTo(TranscriptionState.READY);
          // Persist to storage (skip for incognito sessions)
          if (!isIncognito) {
            await storageService.saveTranscription(transcription);
            await useSessionStore
              .getState()
              .updateSessionModifiedTimestamp(sessionId);
          }
        } else {
          // No transcription to add, just clear previews and transition
          set({
            livePreview: null,
            loadingPreview: null,
            currentStreamingText: '',
            state: TranscriptionState.READY,
          });
        }
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.recording,
          message: 'Error stopping recording',
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
        get().clearRecordingSessionId();
        releaseOperationLock(operationName);
      }
    },

    onPartialTranscription: (partial: string) => {
      const state = get();
      get().updateStreamingText(partial);

      if (
        state.state === TranscriptionState.RECORDING ||
        state.state === TranscriptionState.STREAMING
      ) {
        const sessionId =
          state.recordingSessionId ??
          useSessionStore.getState().activeSessionId;
        get().updateLivePreview(partial, sessionId);
      }
    },

    initialize: async () => {
      const state = get();

      if (state.isInitialized) {
        logWarn('Transcription store already initialized', {
          flag: FeatureFlag.store,
        });
        return;
      }

      const operationName = 'initialization';

      if (!(await acquireOperationLock(operationName))) {
        const error = 'System is busy. Please wait and try again.';
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

        // Initialize Whisper service
        const whisperInitialized = await whisperService.initialize();
        if (!whisperInitialized) {
          logError(
            `Whisper initialization failed: ${whisperService.initializationStatus}`,
            { flag: FeatureFlag.model }
          );
          set({ isWhisperReady: false });
        } else {
          set({ isWhisperReady: true });
        }

        // Subscribe to audio level updates
        const unsubscribeAudioLevel = audioService.subscribeToAudioLevel(
          (level) => {
            get().updateAudioLevel(level);
          }
        );
        set({ audioLevelUnsubscribe: unsubscribeAudioLevel });

        get().transitionTo(TranscriptionState.READY);

        set({ isInitialized: true });
      } catch (error) {
        const errorMessage = `Failed to initialize transcription system: ${error}`;
        logError(error, {
          flag: FeatureFlag.store,
          message: 'Failed to initialize transcription system',
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
      const state = get();

      if (state.partialResultUnsubscribe) {
        state.partialResultUnsubscribe();
      }
      if (state.realtimeAudioLevelUnsubscribe) {
        state.realtimeAudioLevelUnsubscribe();
      }

      set({
        isOperationLocked: false,
        activeOperations: new Set(),
        lastOperationTime: null,
        partialResultUnsubscribe: null,
        realtimeAudioLevelUnsubscribe: null,
      });

      get().clearRecordingSessionId();
      get().clearLivePreview();
      get().clearLoadingPreview();

      get().transitionTo(TranscriptionState.READY);
    },

    dispose: async () => {
      const state = get();

      if (state.audioLevelUnsubscribe) {
        state.audioLevelUnsubscribe();
        set({ audioLevelUnsubscribe: null });
      }

      if (state.partialResultUnsubscribe) {
        state.partialResultUnsubscribe();
        set({ partialResultUnsubscribe: null });
      }

      if (state.realtimeAudioLevelUnsubscribe) {
        state.realtimeAudioLevelUnsubscribe();
        set({ realtimeAudioLevelUnsubscribe: null });
      }

      await audioService.dispose();
      await whisperService.dispose();
    },
  };
});

export const useTranscriptionState = () =>
  useTranscriptionStore((s) => s.state);

export const useSessionTranscriptions = (sessionId?: string) => {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const finalSessionId = sessionId ?? activeSessionId;
  const transcriptions = useTranscriptionStore(
    useShallow((s) => s.transcriptions)
  );

  return useMemo(
    () => transcriptions.filter((t) => t.sessionId === finalSessionId),
    [transcriptions, finalSessionId]
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
