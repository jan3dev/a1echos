import { AudioPlayer, createAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { create } from "zustand";

import { i18n } from "@/localization";
import { getAllDownloadableModels, type DownloadableModelId } from "@/models";
import { modelDownloadService } from "@/services";
import type { DownloadProgress } from "@/services";
import { FeatureFlag, logError, logWarn } from "@/utils";

import {
  AUDIO_BUSY_STATES,
  useTranscriptionStore,
} from "../transcription-store/transcriptionStore";
import { useUIStore } from "../ui-store/uiStore";

let downloadCompletePlayer: AudioPlayer | null = null;
const getDownloadCompletePlayer = (): AudioPlayer | null => {
  if (downloadCompletePlayer) return downloadCompletePlayer;
  try {
    downloadCompletePlayer = createAudioPlayer(
      require("@/assets/sounds/download-complete.wav"),
    );
    return downloadCompletePlayer;
  } catch (error) {
    logWarn(`Failed to load download-complete sound: ${String(error)}`, {
      flag: FeatureFlag.model,
    });
    return null;
  }
};

const notifyDownloadComplete = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    (err) => {
      logWarn(`Haptic feedback not supported: ${String(err)}`, {
        flag: FeatureFlag.model,
      });
    },
  );

  // Skip chime if the audio session is already in use for recording/transcription.
  const transcriptionState = useTranscriptionStore.getState().state;
  if (!AUDIO_BUSY_STATES.has(transcriptionState)) {
    try {
      const player = getDownloadCompletePlayer();
      if (player) {
        player.seekTo(0);
        player.play();
      }
    } catch (error) {
      logWarn(`Failed to play download-complete sound: ${String(error)}`, {
        flag: FeatureFlag.model,
      });
    }
  }

  useUIStore
    .getState()
    .showGlobalTooltip(i18n.t("downloadedToast"), "normal", 3000);
};

interface ModelDownloadStore {
  /** Current download progress per model */
  downloadStates: Partial<Record<DownloadableModelId, DownloadProgress>>;
  /** Set of model IDs that are verified as downloaded */
  downloadedModels: Set<DownloadableModelId>;
  /** Whether the store has been initialized */
  isInitialized: boolean;

  initialize: () => void;
  startDownload: (modelId: DownloadableModelId) => Promise<boolean>;
  cancelDownload: (modelId: DownloadableModelId) => void;
  deleteModel: (modelId: DownloadableModelId) => Promise<boolean>;
  isDownloaded: (modelId: DownloadableModelId) => boolean;
  getProgress: (modelId: DownloadableModelId) => DownloadProgress | undefined;
}

export const useModelDownloadStore = create<ModelDownloadStore>((set, get) => ({
  downloadStates: {},
  downloadedModels: new Set(),
  isInitialized: false,

  initialize: () => {
    // Scan filesystem for already-downloaded models
    const downloaded = new Set<DownloadableModelId>();
    for (const model of getAllDownloadableModels()) {
      if (modelDownloadService.isModelDownloaded(model.id)) {
        downloaded.add(model.id);
      }
    }
    set({ downloadedModels: downloaded, isInitialized: true });
  },

  startDownload: async (modelId: DownloadableModelId): Promise<boolean> => {
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
        notifyDownloadComplete();
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

  cancelDownload: (modelId: DownloadableModelId) => {
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

  deleteModel: async (modelId: DownloadableModelId): Promise<boolean> => {
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

  isDownloaded: (modelId: DownloadableModelId): boolean => {
    return get().downloadedModels.has(modelId);
  },

  getProgress: (modelId: DownloadableModelId): DownloadProgress | undefined => {
    return get().downloadStates[modelId];
  },
}));

export const useIsModelDownloaded = (modelId: DownloadableModelId) =>
  useModelDownloadStore((s) => s.downloadedModels.has(modelId));

export const useModelDownloadProgress = (modelId: DownloadableModelId) =>
  useModelDownloadStore((s) => s.downloadStates[modelId]);

export const initializeModelDownloadStore = (): void => {
  useModelDownloadStore.getState().initialize();
};

export default useModelDownloadStore;
