import { create } from "zustand";

import { ModelId, getAllModels } from "@/models";
import { modelDownloadService } from "@/services/ModelDownloadService";
import type { DownloadProgress } from "@/services/ModelDownloadService";
import { FeatureFlag, logError } from "@/utils";

interface ModelDownloadStore {
  /** Current download progress per model */
  downloadStates: Partial<Record<ModelId, DownloadProgress>>;
  /** Set of model IDs that are verified as downloaded */
  downloadedModels: Set<ModelId>;
  /** Whether the store has been initialized */
  isInitialized: boolean;

  initialize: () => void;
  startDownload: (modelId: ModelId) => Promise<boolean>;
  cancelDownload: (modelId: ModelId) => void;
  deleteModel: (modelId: ModelId) => Promise<boolean>;
  isDownloaded: (modelId: ModelId) => boolean;
  getProgress: (modelId: ModelId) => DownloadProgress | undefined;
}

export const useModelDownloadStore = create<ModelDownloadStore>((set, get) => ({
  downloadStates: {},
  downloadedModels: new Set(),
  isInitialized: false,

  initialize: () => {
    // Scan filesystem for already-downloaded models
    const downloaded = new Set<ModelId>();
    for (const model of getAllModels()) {
      if (modelDownloadService.isModelDownloaded(model.id)) {
        downloaded.add(model.id);
      }
    }
    set({ downloadedModels: downloaded, isInitialized: true });
  },

  startDownload: async (modelId: ModelId): Promise<boolean> => {
    const current = get().downloadStates[modelId];
    if (current?.status === "downloading") {
      return false; // Already downloading
    }

    try {
      const success = await modelDownloadService.downloadModel(
        modelId,
        (progress) => {
          set((state) => ({
            downloadStates: {
              ...state.downloadStates,
              [modelId]: progress,
            },
          }));
        },
      );

      if (success) {
        set((state) => {
          const newDownloaded = new Set(state.downloadedModels);
          newDownloaded.add(modelId);
          return { downloadedModels: newDownloaded };
        });
      }

      return success;
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.model,
        message: `Failed to download model: ${modelId}`,
      });
      return false;
    }
  },

  cancelDownload: (modelId: ModelId) => {
    modelDownloadService.cancelDownload(modelId);
    // Optimistically update UI state so progress bar disappears immediately
    const current = get().downloadStates[modelId];
    if (current) {
      set((state) => ({
        downloadStates: {
          ...state.downloadStates,
          [modelId]: { ...current, status: "cancelled" as const },
        },
      }));
    }
  },

  deleteModel: async (modelId: ModelId): Promise<boolean> => {
    const success = await modelDownloadService.deleteModel(modelId);
    if (success) {
      set((state) => {
        const newDownloaded = new Set(state.downloadedModels);
        newDownloaded.delete(modelId);
        const newStates = { ...state.downloadStates };
        delete newStates[modelId];
        return { downloadedModels: newDownloaded, downloadStates: newStates };
      });
    }
    return success;
  },

  isDownloaded: (modelId: ModelId): boolean => {
    return get().downloadedModels.has(modelId);
  },

  getProgress: (modelId: ModelId): DownloadProgress | undefined => {
    return get().downloadStates[modelId];
  },
}));

export const useIsModelDownloaded = (modelId: ModelId) =>
  useModelDownloadStore((s) => s.downloadedModels.has(modelId));

export const useModelDownloadProgress = (modelId: ModelId) =>
  useModelDownloadStore((s) => s.downloadStates[modelId]);

export const initializeModelDownloadStore = (): void => {
  useModelDownloadStore.getState().initialize();
};

export default useModelDownloadStore;
