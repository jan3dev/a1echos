import * as Crypto from "expo-crypto";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { AppState } from "react-native";
import { create } from "zustand";

import { type LlmModelId, Transcription, TranscriptionState } from "@/models";
import {
  databaseService,
  llmService,
  structure,
  summarize,
  SummaryCancelledError,
  type StructureDeps,
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

export type StructureResult =
  | { outcome: "done"; text: string }
  | { outcome: Exclude<SummarizeOutcome, "done"> };

interface SummaryStore {
  job: SummaryJob | null;
  isStructuring: boolean;
  summarizeSession: (sessionId: string) => Promise<SummarizeOutcome>;
  /** Formats `text` into organized notes; the caller decides whether to keep them. */
  structureText: (text: string) => Promise<StructureResult>;
  /** Stops a running summary or structuring. */
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

  const isBusy = () => get().job !== null || get().isStructuring;

  const cancel = (reason: "stopped" | "cancelled") => {
    if (!isBusy() || stopReason) return;
    stopReason = reason;
    llmService.stop().catch(() => {});
  };

  /** The model to run, or "cancelled"/"no-model" when it can't run now. */
  const readyLlm = () => {
    if (isBusy()) throw new Error("The AI model is already running");
    if (blocksSummary(useTranscriptionStore.getState().state)) {
      return "cancelled";
    }
    const llmId = useSettingsStore.getState().selectedLlmId;
    if (!llmId || !useModelDownloadStore.getState().isDownloaded(llmId)) {
      return "no-model";
    }
    return llmId;
  };

  /** Marks the store `busy`, runs `work` with the model loaded, then clears
   *  it. A stop resolves as its reason; failures are logged and rethrown. */
  const runLlm = async <T extends object>(
    busy: Partial<SummaryStore>,
    failure: string,
    work: (isCancelled: () => boolean) => Promise<T>,
  ): Promise<T | "stopped" | "cancelled"> => {
    stopReason = null;
    set(busy);
    // A long run outlasts auto-lock, which would background and cancel it.
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    // iOS refuses GPU work from the background, and either OS may kill a
    // backgrounded app mid-run; stop cleanly instead.
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "background") cancel("cancelled");
    });
    const unsubscribe = useTranscriptionStore.subscribe((s) => {
      if (blocksSummary(s.state)) cancel("cancelled");
    });
    try {
      return await work(() => stopReason !== null);
    } catch (error) {
      if (error instanceof SummaryCancelledError) {
        return stopReason ?? "cancelled";
      }
      logError(error, { flag: FeatureFlag.store, message: failure });
      throw error;
    } finally {
      appState.remove();
      unsubscribe();
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
      set({ job: null, isStructuring: false });
      // The next recording needs the memory more than a warm model.
      await llmService.release().catch(() => {});
    }
  };

  const llmDeps = (
    llmId: LlmModelId,
    isCancelled: () => boolean,
  ): StructureDeps => ({
    budget: llmService.inputBudget(llmId),
    finalOutputTokens: (tokens) => llmService.finalOutputTokens(llmId, tokens),
    countTokens: (input) => llmService.countTokens(llmId, input),
    complete: async (task, input, options) =>
      (await llmService.run(llmId, task, input, { ...options, isCancelled }))
        .text,
    isCancelled,
  });

  return {
    job: null,
    isStructuring: false,

    summarizeSession: async (sessionId) => {
      const llmId = readyLlm();
      if (llmId === "cancelled" || llmId === "no-model") return llmId;
      const text = summarizableText(
        useTranscriptionStore.getState().sessionTranscriptions(sessionId),
      );
      if (!text) return "empty";

      const result = await runLlm(
        {
          job: {
            sessionId,
            startedAt: new Date(),
            text: "",
            part: 0,
            parts: 0,
          },
        },
        "Failed to summarize session",
        async (stopped) => {
          const isCancelled = () =>
            stopped() || !useSessionStore.getState().findSessionById(sessionId);
          const summary = await summarize(text, {
            ...llmDeps(llmId, isCancelled),
            finalBudget: llmService.finalInputBudget(llmId),
            onProgress: (part, parts) => updateJob({ part, parts }),
            onText: (partial) => updateJob({ text: partial }),
          });
          if (!summary) throw new Error("The model returned an empty summary");
          return { saved: await save(sessionId, summary) };
        },
      );
      if (typeof result === "string") return result;
      return result.saved ? "done" : "cancelled";
    },

    structureText: async (text) => {
      const llmId = readyLlm();
      if (llmId === "cancelled" || llmId === "no-model") {
        return { outcome: llmId };
      }
      if (!text.trim()) return { outcome: "empty" };

      const result = await runLlm(
        { isStructuring: true },
        "Failed to structure notes",
        async (isCancelled) => {
          const notes = await structure(text, llmDeps(llmId, isCancelled));
          if (!notes) throw new Error("The model returned empty notes");
          return { outcome: "done" as const, text: notes };
        },
      );
      return typeof result === "string" ? { outcome: result } : result;
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
export const useIsStructuring = () => useSummaryStore((s) => s.isStructuring);
export const useStructureText = () => useSummaryStore((s) => s.structureText);
