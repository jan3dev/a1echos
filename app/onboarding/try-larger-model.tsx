import { useRouter } from "expo-router";
import { useEffect } from "react";

import { TryLargerModelScreen } from "@/components";
import { Routes } from "@/constants";
import { useEnsureModelDownloaded } from "@/hooks";
import { getModelInfo, getRecommendedModelId, ModelId } from "@/models";
import {
  useIsModelDownloaded,
  useModelDownloadProgress,
  useModelDownloadStore,
  useSelectedLanguage,
  useSelectedModelId,
  useSetModelId,
} from "@/stores";
import { FeatureFlag, logError } from "@/utils";

export default function TryLargerModel() {
  const router = useRouter();
  const language = useSelectedLanguage();
  const model = getModelInfo(getRecommendedModelId(language.code));
  const isDownloaded = useIsModelDownloaded(model.id);
  const progress = useModelDownloadProgress(model.id);
  const cancelDownload = useModelDownloadStore((s) => s.cancelDownload);
  const selectedModelId = useSelectedModelId();
  const setModelId = useSetModelId();
  const ensureModelDownloaded = useEnsureModelDownloaded();

  const selectModel = async () => {
    try {
      await setModelId(model.id);
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.settings,
        message: "Failed to select onboarding model",
      });
    }
  };

  const handleDownload = async () => {
    // Space check, in-flight guard and failure toast live in the hook.
    if (await ensureModelDownloaded(model.id)) await selectModel();
  };

  // Back (button, gesture or hardware) unmounts the screen; backgrounding
  // doesn't, so the download carries on then.
  useEffect(() => () => cancelIfDownloading(model.id), [model.id]);

  const handleNext = async () => {
    cancelIfDownloading(model.id);
    // Covers a download whose auto-select failed.
    if (isDownloaded && selectedModelId !== model.id) await selectModel();
    router.push(Routes.onboardingTutorialIntro);
  };

  return (
    <TryLargerModelScreen
      testID="try-larger-model"
      model={model}
      isDownloaded={isDownloaded}
      isSelected={selectedModelId === model.id}
      downloadProgress={progress}
      onDownload={handleDownload}
      onCancelDownload={() => cancelDownload(model.id)}
      onSelect={selectModel}
      onBack={router.back}
      onNext={handleNext}
    />
  );
}

// Leaving abandons the offer, so an in-flight download is cancelled. Only
// while downloading: cancelDownload marks any existing state as cancelled.
const cancelIfDownloading = (modelId: ModelId) => {
  const { getProgress, cancelDownload } = useModelDownloadStore.getState();
  if (getProgress(modelId)?.status === "downloading") cancelDownload(modelId);
};
