import { Directory, File, Paths } from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";

import { ModelId, getModelInfo } from "@/models";
import { FeatureFlag, logError } from "@/utils";

export interface DownloadProgress {
  modelId: ModelId;
  totalBytes: number;
  downloadedBytes: number;
  progressRatio: number;
  status: "checking" | "downloading" | "complete" | "error" | "cancelled";
  error?: string;
  /** Index of the file currently being downloaded */
  currentFileIndex: number;
  totalFiles: number;
}

const MODELS_DIR = `${Paths.document.uri}/models`;

const getModelDir = (modelId: ModelId): string => `${MODELS_DIR}/${modelId}`;

const PROGRESS_THROTTLE_MS = 1000;

const createModelDownloadService = () => {
  const activeDownloads = new Map<
    ModelId,
    {
      cancelled: boolean;
      resumable?: LegacyFileSystem.DownloadResumable;
    }
  >();

  const ensureModelsDir = (): void => {
    const dir = new Directory(MODELS_DIR);
    if (!dir.exists) {
      dir.create();
    }
  };

  const ensureModelDir = (modelId: ModelId): string => {
    ensureModelsDir();
    const modelDir = getModelDir(modelId);
    const dir = new Directory(modelDir);
    if (!dir.exists) {
      dir.create();
    }
    return modelDir;
  };

  const isModelDownloaded = (modelId: ModelId): boolean => {
    const modelInfo = getModelInfo(modelId);
    if (modelInfo.isBundled) return true;

    const modelDir = getModelDir(modelId);
    const dir = new Directory(modelDir);
    if (!dir.exists) return false;

    // Check all files exist
    return modelInfo.files.every((file) => {
      const f = new File(`${modelDir}/${file.name}`);
      return f.exists;
    });
  };

  const getDownloadedModelIds = (): ModelId[] => {
    return Object.values(ModelId).filter((id) => isModelDownloaded(id));
  };

  const getDownloadedModelSize = (modelId: ModelId): number => {
    const modelInfo = getModelInfo(modelId);
    const modelDir = getModelDir(modelId);
    const dir = new Directory(modelDir);
    if (!dir.exists) return 0;

    let total = 0;
    for (const fileInfo of modelInfo.files) {
      const f = new File(`${modelDir}/${fileInfo.name}`);
      if (f.exists) {
        total += f.size ?? 0;
      }
    }
    return total;
  };

  const checkDiskSpace = async (
    modelId: ModelId,
  ): Promise<{
    available: number;
    required: number;
    sufficient: boolean;
  }> => {
    const modelInfo = getModelInfo(modelId);
    const required = modelInfo.sizeBytes;

    try {
      const available = Paths.availableDiskSpace;
      return { available, required, sufficient: available > required * 1.1 };
    } catch {
      return { available: 0, required, sufficient: false };
    }
  };

  const downloadModel = async (
    modelId: ModelId,
    onProgress: (progress: DownloadProgress) => void,
  ): Promise<boolean> => {
    const modelInfo = getModelInfo(modelId);
    if (modelInfo.isBundled) return true;
    if (!modelInfo.downloadBaseUrl) {
      throw new Error(`No download URL for model: ${modelId}`);
    }

    if (activeDownloads.has(modelId)) {
      throw new Error(`Download already in progress for: ${modelId}`);
    }

    const downloadState = {
      cancelled: false,
      resumable: undefined as LegacyFileSystem.DownloadResumable | undefined,
    };
    activeDownloads.set(modelId, downloadState);

    const modelDir = ensureModelDir(modelId);
    let totalDownloaded = 0;

    const emitProgress = (
      status: DownloadProgress["status"],
      fileIndex: number,
      error?: string,
    ): void => {
      onProgress({
        modelId,
        totalBytes: modelInfo.sizeBytes,
        downloadedBytes: totalDownloaded,
        progressRatio:
          modelInfo.sizeBytes > 0
            ? Math.min(1, totalDownloaded / modelInfo.sizeBytes)
            : 0,
        status,
        error,
        currentFileIndex: fileIndex,
        totalFiles: modelInfo.files.length,
      });
    };

    try {
      emitProgress("checking", 0);

      for (let i = 0; i < modelInfo.files.length; i++) {
        if (downloadState.cancelled) {
          emitProgress("cancelled", i);
          return false;
        }

        const fileInfo = modelInfo.files[i];
        const filePath = `${modelDir}/${fileInfo.name}`;
        const file = new File(filePath);

        // Ensure intermediate directories exist for files nested in subfolders
        // (e.g. "tokenizer/vocab.json"); the native download streamer won't
        // auto-create them.
        const lastSlash = fileInfo.name.lastIndexOf("/");
        if (lastSlash > 0) {
          const subDir = new Directory(
            `${modelDir}/${fileInfo.name.slice(0, lastSlash)}`,
          );
          if (!subDir.exists) {
            subDir.create();
          }
        }

        // Skip if file already exists and is at least the expected size
        if (file.exists && (file.size ?? 0) >= fileInfo.sizeBytes) {
          totalDownloaded += fileInfo.sizeBytes;
          emitProgress("downloading", i);
          continue;
        }

        // Delete partial file if it exists
        if (file.exists) {
          file.delete();
        }

        const url = `${modelInfo.downloadBaseUrl}/${fileInfo.name}`;
        const legacyDestUri = filePath;
        const bytesBeforeFile = totalDownloaded;
        let lastEmitTime = 0;

        emitProgress("downloading", i);

        // Use createDownloadResumable for native streaming to disk
        const resumable = LegacyFileSystem.createDownloadResumable(
          url,
          legacyDestUri,
          {},
          (data) => {
            // Throttle progress updates to ~1 second
            const now = Date.now();
            if (now - lastEmitTime < PROGRESS_THROTTLE_MS) return;
            lastEmitTime = now;

            totalDownloaded = bytesBeforeFile + data.totalBytesWritten;
            emitProgress("downloading", i);
          },
        );

        downloadState.resumable = resumable;

        const result = await resumable.downloadAsync();

        downloadState.resumable = undefined;

        if (downloadState.cancelled) {
          emitProgress("cancelled", i);
          return false;
        }

        if (!result) {
          throw new Error(`Download cancelled or failed for ${fileInfo.name}`);
        }

        // Update total with actual completed file size
        totalDownloaded = bytesBeforeFile + fileInfo.sizeBytes;
        emitProgress("downloading", i);
      }

      if (downloadState.cancelled) {
        emitProgress("cancelled", modelInfo.files.length);
        return false;
      }

      emitProgress("complete", modelInfo.files.length);
      return true;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Download failed";
      logError(error, {
        flag: FeatureFlag.model,
        message: `Model download failed: ${modelId}`,
      });
      emitProgress("error", 0, errorMsg);
      return false;
    } finally {
      activeDownloads.delete(modelId);
    }
  };

  const cancelDownload = (modelId: ModelId): void => {
    const download = activeDownloads.get(modelId);
    if (download) {
      download.cancelled = true;
      download.resumable?.cancelAsync().catch(() => {
        // Ignore cancel errors
      });
    }
  };

  const deleteModel = async (modelId: ModelId): Promise<boolean> => {
    const modelInfo = getModelInfo(modelId);
    if (modelInfo.isBundled) return false; // Don't delete bundled models

    try {
      const modelDir = getModelDir(modelId);
      const dir = new Directory(modelDir);
      if (dir.exists) {
        dir.delete();
      }
      return true;
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.model,
        message: `Failed to delete model: ${modelId}`,
      });
      return false;
    }
  };

  const getModelPath = (modelId: ModelId): string | null => {
    if (!isModelDownloaded(modelId)) return null;
    return getModelDir(modelId);
  };

  return {
    isModelDownloaded,
    getDownloadedModelIds,
    getDownloadedModelSize,
    checkDiskSpace,
    downloadModel,
    cancelDownload,
    deleteModel,
    getModelPath,
  };
};

export const modelDownloadService = createModelDownloadService();
export default modelDownloadService;
