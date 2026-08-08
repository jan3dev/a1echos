import { useCallback } from "react";

import type { ModelId } from "@/models";
import { modelDownloadService } from "@/services";
import { useModelDownloadStore, useShowGlobalTooltip } from "@/stores";
import { formatBytes } from "@/utils";

import { useLocalization } from "../use-localization/useLocalization";

/**
 * Starts a model download, with the checks a caller should not have to
 * remember: no-op while one is already in flight, a disk-space pre-check that
 * surfaces an error toast instead of failing mid-transfer, and a toast on
 * failure (the download store reports failures by returning `false`, which is
 * easy to drop on the floor).
 *
 * Resolves `true` only when the model is present afterwards, so callers can
 * chain follow-up work (selecting the model, enabling a feature) on real
 * success. Shared by the model picker and the context-aware autocorrect toggle.
 */
export const useEnsureModelDownloaded = () => {
  const downloadStore = useModelDownloadStore();
  const showGlobalTooltip = useShowGlobalTooltip();
  const { loc } = useLocalization();

  return useCallback(
    async (modelId: ModelId): Promise<boolean> => {
      if (downloadStore.getProgress(modelId)?.status === "downloading") {
        return false;
      }

      const diskCheck = await modelDownloadService.checkDiskSpace(modelId);
      if (!diskCheck.sufficient) {
        showGlobalTooltip(
          loc.insufficientSpace(
            formatBytes(diskCheck.required),
            formatBytes(diskCheck.available),
          ),
          "error",
          5000,
        );
        return false;
      }

      const success = await downloadStore.startDownload(modelId);
      // A user-initiated cancel is not a failure worth reporting back at them.
      if (
        !success &&
        downloadStore.getProgress(modelId)?.status !== "cancelled"
      ) {
        showGlobalTooltip(loc.downloadFailed, "error", 5000);
      }
      return success;
    },
    [downloadStore, showGlobalTooltip, loc],
  );
};
