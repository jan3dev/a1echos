import type { ModelId } from "@/models";
import { modelDownloadService, sherpaTranscriptionService } from "@/services";
import { FeatureFlag, logError } from "@/utils";

import { AUDIO_BUSY_STATES, useTranscriptionStore } from "./transcriptionStore";

/**
 * Eagerly load the sherpa-onnx engine for `modelId` so that subsequent
 * `startRecording` calls don't pay the multi-second init cost. Fire-and-forget;
 * skips silently if a recording is already in progress or the model files
 * aren't downloaded yet. The underlying service short-circuits when the
 * requested model + language is already active, so repeat calls are cheap.
 */
export const preWarmModel = (modelId: ModelId, language: string): void => {
  const store = useTranscriptionStore.getState();
  if (AUDIO_BUSY_STATES.has(store.state)) {
    return;
  }
  if (!modelDownloadService.isModelDownloaded(modelId)) {
    return;
  }

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
      useTranscriptionStore.getState().setEngineInitializing(false);
    });
};
