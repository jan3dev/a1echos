import * as Crypto from "expo-crypto";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { AppState } from "react-native";
import { create } from "zustand";

import { Transcription, TranscriptionState } from "@/models";
import {
  databaseService,
  llmService,
  summarize,
  SummaryCancelledError,
} from "@/services";
import { FeatureFlag, logError } from "@/utils";

import { useModelDownloadStore } from "../model-download-store/modelDownloadStore";
import { useSessionStore } from "../session-store/sessionStore";
import { useSettingsStore } from "../settings-store/settingsStore";
import {
  AUDIO_BUSY_STATES,
  useTranscriptionStore,
} from "../transcription-store/transcriptionStore";

/** "stopped": the user pressed Stop; "cancelled": the app stopped it. */
export type SummarizeOutcome =
  "done" | "stopped" | "cancelled" | "no-model" | "empty";

export interface SummaryJob {
  sessionId: string;
  startedAt: Date;
  /** The final pass's output so far; empty while chunks are summarized. */
  text: string;
  /** Chunk in progress (1-based) and chunk count; 0 for a single pass. */
  part: number;
  parts: number;
}

interface SummaryStore {
  job: SummaryJob | null;
  summarizeSession: (sessionId: string) => Promise<SummarizeOutcome>;
  cancelSummary: () => void;
}

// Recording or transcribing needs the CPU and the memory the LLM holds; the
// summary yields. LOADING (ASR pre-warm) is short and not user-initiated.
export const blocksSummary = (state: TranscriptionState): boolean =>
  state !== TranscriptionState.LOADING && AUDIO_BUSY_STATES.has(state);

/** What a summary reads: the session's transcripts, never earlier summaries. */
export const summarizableText = (transcriptions: Transcription[]): string =>
  transcriptions
    .filter((t) => t.kind !== "summary")
    .map((t) => t.text.trim())
    .filter(Boolean)
    .join("\n\n");

const KEEP_AWAKE_TAG = "summary";

let stopReason: "stopped" | "cancelled" | null = null;

export const useSummaryStore = create<SummaryStore>((set, get) => {
  const updateJob = (patch: Partial<SummaryJob>) =>
    set((s) => ({ job: s.job && { ...s.job, ...patch } }));

  const save = async (sessionId: string, text: string): Promise<boolean> => {
    const session = useSessionStore.getState().findSessionById(sessionId);
    if (!session) return false;
    const summary: Transcription = {
      id: Crypto.randomUUID(),
      sessionId,
      text,
      timestamp: new Date(),
      audioPath: "",
      kind: "summary",
    };
    if (!session.isIncognito) {
      await databaseService.upsertTranscription(summary);
      await useSessionStore
        .getState()
        .updateSessionModifiedTimestamp(sessionId)
        .catch((error) =>
          logError(error, {
            flag: FeatureFlag.store,
            message: "Failed to update session after summary",
          }),
        );
    }
    // Last, right before the job clears, so the preview and the saved
    // summary don't both show.
    useTranscriptionStore.getState().addTranscription(summary);
    return true;
  };

  const cancel = (reason: "stopped" | "cancelled") => {
    if (!get().job || stopReason) return;
    stopReason = reason;
    llmService.stop().catch(() => {});
  };

  return {
    job: null,

    summarizeSession: async (sessionId) => {
      if (get().job) throw new Error("A summary is already running");

      if (blocksSummary(useTranscriptionStore.getState().state)) {
        return "cancelled";
      }
      const llmId = useSettingsStore.getState().selectedLlmId;
      if (!llmId || !useModelDownloadStore.getState().isDownloaded(llmId)) {
        return "no-model";
      }
      const text = summarizableText(
        useTranscriptionStore.getState().sessionTranscriptions(sessionId),
      );
      if (!text) return "empty";

      stopReason = null;
      set({
        job: { sessionId, startedAt: new Date(), text: "", part: 0, parts: 0 },
      });
      // A long summary outlasts auto-lock, which would background and cancel it.
      activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
      // iOS refuses GPU work from the background, and either OS may kill a
      // backgrounded app mid-summary; stop cleanly instead.
      const appState = AppState.addEventListener("change", (state) => {
        if (state === "background") cancel("cancelled");
      });
      const unsubscribe = useTranscriptionStore.subscribe((s) => {
        if (blocksSummary(s.state)) cancel("cancelled");
      });

      const isCancelled = () =>
        stopReason !== null ||
        !useSessionStore.getState().findSessionById(sessionId);

      try {
        const summary = await summarize(text, {
          budget: llmService.inputBudget(llmId),
          finalBudget: llmService.finalInputBudget(llmId),
          finalOutputTokens: (tokens) =>
            llmService.finalOutputTokens(llmId, tokens),
          countTokens: (input) => llmService.countTokens(llmId, input),
          complete: async (task, input, options) =>
            (
              await llmService.run(llmId, task, input, {
                ...options,
                isCancelled,
              })
            ).text,
          isCancelled,
          onProgress: (part, parts) => updateJob({ part, parts }),
          onText: (partial) => updateJob({ text: partial }),
        });
        if (!summary) throw new Error("The model returned an empty summary");
        return (await save(sessionId, summary)) ? "done" : "cancelled";
      } catch (error) {
        if (error instanceof SummaryCancelledError) {
          return stopReason ?? "cancelled";
        }
        logError(error, {
          flag: FeatureFlag.store,
          message: "Failed to summarize session",
        });
        throw error;
      } finally {
        appState.remove();
        unsubscribe();
        deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
        set({ job: null });
        // The next recording needs the memory more than a warm model.
        await llmService.release().catch(() => {});
      }
    },

    cancelSummary: () => cancel("stopped"),
  };
});

export const useSummaryJob = () => useSummaryStore((s) => s.job);
/** Re-renders only when a summary starts or ends, not per streamed token. */
export const useSummarySessionId = () =>
  useSummaryStore((s) => s.job?.sessionId ?? null);
export const useIsSummaryBlocked = () =>
  useTranscriptionStore((s) => blocksSummary(s.state));
export const useSummarizeSession = () =>
  useSummaryStore((s) => s.summarizeSession);
export const useCancelSummary = () => useSummaryStore((s) => s.cancelSummary);
