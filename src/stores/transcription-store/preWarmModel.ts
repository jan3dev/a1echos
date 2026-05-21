import type { ModelId } from "@/models";
import { modelDownloadService, sherpaTranscriptionService } from "@/services";
import { FeatureFlag, logError } from "@/utils";

// transcriptionStore is resolved lazily to break a Metro require cycle:
// settingsStore → preWarmModel → transcriptionStore → settingsStore.
// All references below are runtime, so deferring is safe.
const lazyTranscriptionStore = () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./transcriptionStore") as typeof import("./transcriptionStore");

// Tracks the most recent pre-warm. If the user changes models mid-warmup the
// service re-enters its in-flight init promise and starts a second cycle; we
// must only clear `isEngineInitializing` when the *latest* call settles, or
// the spinner will flip off while the second init is still loading.
let preWarmGeneration = 0;

/**
 * Eagerly load the sherpa-onnx engine for `modelId` so that subsequent
 * `startRecording` calls don't pay the multi-second init cost. Fire-and-forget;
 * skips silently if a recording is already in progress or the model files
 * aren't downloaded yet. The underlying service short-circuits when the
 * requested model + language is already active, so repeat calls are cheap.
 */
export const preWarmModel = (modelId: ModelId, language: string): void => {
  const { AUDIO_BUSY_STATES, useTranscriptionStore } = lazyTranscriptionStore();
  const store = useTranscriptionStore.getState();
  if (AUDIO_BUSY_STATES.has(store.state)) {
    return;
  }
  if (!modelDownloadService.isModelDownloaded(modelId)) {
    return;
  }

  const generation = ++preWarmGeneration;
  store.setEngineInitializing(true);
  void sherpaTranscriptionService
    .initialize(modelId, language)
    .catch((err) => {
      logError(err, {
        flag: FeatureFlag.model,
        message: "Failed to pre-warm transcription model",
      });
    })
    .finally(() => {
      if (generation !== preWarmGeneration) return;
      useTranscriptionStore.getState().setEngineInitializing(false);
    });
};
