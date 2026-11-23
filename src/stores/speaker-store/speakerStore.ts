import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { create } from "zustand";

import { i18n } from "@/localization";
import {
  type Session,
  SPEAKER_MODEL,
  type Transcription,
  TranscriptionState,
} from "@/models";
import {
  audioProtectionService,
  diarizationService,
  modelDownloadService,
  SpeakerIdentificationCancelledError,
} from "@/services";
import { FeatureFlag, logError } from "@/utils";

import { useModelDownloadStore } from "../model-download-store/modelDownloadStore";
import { useSessionStore } from "../session-store/sessionStore";
import { useTranscriptionStore } from "../transcription-store/transcriptionStore";

export type IdentifySpeakersOutcome =
  "done" | "one-speaker" | "no-audio" | "no-model" | "busy" | "stopped";

interface SpeakerJob {
  sessionId: string;
  /** 0–1 */
  progress: number;
}

interface SpeakerStore {
  job: SpeakerJob | null;
  /**
   * Labels who is talking in a session's recordings, splitting items where
   * the speaker changes. Speaker numbers are consistent across the session.
   */
  identifySpeakers: (sessionId: string) => Promise<IdentifySpeakersOutcome>;
  cancelIdentifySpeakers: () => void;
}

// Listening for voices is the quick half; transcribing the split turns again
// is the slow one.
const ANALYSIS_SHARE = 0.4;
const KEEP_AWAKE_TAG = "speakers";

let cancelRequested = false;

export const speakerName = (
  session: Session | null | undefined,
  speaker: number,
): string =>
  session?.speakerNames?.[speaker]?.trim() ||
  i18n.t("speakerDefaultName", { number: speaker + 1 });

/** Transcripts as shared, copied or summarized: each identified turn names
 *  its speaker. */
export const labelSpeakers = (
  transcriptions: Transcription[],
): Transcription[] =>
  transcriptions.map((t) =>
    t.speaker === undefined
      ? t
      : {
          ...t,
          text: `${speakerName(
            useSessionStore.getState().findSessionById(t.sessionId),
            t.speaker,
          )}: ${t.text}`,
        },
  );

export const useSpeakerStore = create<SpeakerStore>((set, get) => ({
  job: null,

  identifySpeakers: async (sessionId) => {
    if (get().job) return "busy";
    if (!useModelDownloadStore.getState().isDownloaded(SPEAKER_MODEL.id)) {
      return "no-model";
    }
    const modelDir = modelDownloadService.getModelPath(SPEAKER_MODEL.id);
    if (!modelDir) return "no-model";

    const transcriptionStore = useTranscriptionStore.getState;
    const items = transcriptionStore()
      .sessionTranscriptions(sessionId)
      .filter(
        (t) =>
          t.kind !== "summary" &&
          audioProtectionService.audioExists(t.audioPath),
      );
    if (items.length === 0) return "no-audio";
    if (
      transcriptionStore().state !== TranscriptionState.READY ||
      !transcriptionStore().transitionTo(TranscriptionState.TRANSCRIBING)
    ) {
      return "busy";
    }

    cancelRequested = false;
    set({ job: { sessionId, progress: 0 } });
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    const opened: { path: string; release: () => Promise<void> }[] = [];
    try {
      for (const item of items) {
        opened.push(
          await audioProtectionService.openPlaintextAudio(item.audioPath),
        );
      }
      const { turns, speakerCount } = await diarizationService.identifyTurns(
        opened.map((o) => o.path),
        `${modelDir}/${SPEAKER_MODEL.files[0].name}`,
        {
          onProgress: (fraction) =>
            set({ job: { sessionId, progress: fraction * ANALYSIS_SHARE } }),
          isCancelled: () => cancelRequested,
        },
      );
      if (speakerCount < 2) return "one-speaker";

      for (let i = 0; i < items.length; i++) {
        if (cancelRequested) return "stopped";
        // Skip anything edited or deleted while the voices were analyzed.
        const current = transcriptionStore().transcriptions.find(
          (t) => t.id === items[i].id,
        );
        if (current && current.audioPath === items[i].audioPath) {
          if (turns[i].length === 1) {
            await transcriptionStore().updateTranscription({
              ...current,
              speaker: turns[i][0].speaker,
            });
          } else if (turns[i].length > 1) {
            await transcriptionStore().splitTranscriptionBySpeaker(
              current,
              turns[i],
              opened[i].path,
            );
          }
        }
        set({
          job: {
            sessionId,
            progress:
              ANALYSIS_SHARE + ((i + 1) / items.length) * (1 - ANALYSIS_SHARE),
          },
        });
      }
      return "done";
    } catch (error) {
      if (error instanceof SpeakerIdentificationCancelledError) {
        return "stopped";
      }
      logError(error, {
        flag: FeatureFlag.transcription,
        message: "Failed to identify speakers",
      });
      throw error;
    } finally {
      await Promise.allSettled(opened.map((o) => o.release()));
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
      transcriptionStore().transitionTo(TranscriptionState.READY);
      set({ job: null });
    }
  },

  cancelIdentifySpeakers: () => {
    cancelRequested = true;
  },
}));

export const useSpeakerJob = () => useSpeakerStore((s) => s.job);
export const useIdentifySpeakers = () =>
  useSpeakerStore((s) => s.identifySpeakers);
export const useCancelIdentifySpeakers = () =>
  useSpeakerStore((s) => s.cancelIdentifySpeakers);
