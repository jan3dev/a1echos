import { useCallback, useRef, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Button,
  Card,
  Divider,
  ListItem,
  Radio,
  Text,
  TopAppBar,
} from "@/components";
import { Toast } from "@/components/ui/toast/Toast";
import { useToast } from "@/components/ui/toast/useToast";
import { TestID } from "@/constants";
import { useLocalization } from "@/hooks";
import type { ModelInfo } from "@/models";
import {
  ModelId,
  TranscriptionMode,
  getAllModels,
  getModelInfo,
} from "@/models";
import type { DownloadProgress } from "@/services/ModelDownloadService";
import {
  useModelDownloadStore,
  useSelectedModelId,
  useSelectedTranscriptionMode,
  useSettingsStore,
} from "@/stores";
import { useTheme } from "@/theme";
import { FeatureFlag, logError } from "@/utils";

const APP_BAR_HEIGHT = 60;

const formatBytes = (bytes: number): string => {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(0)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
};

export default function ModelSettingsScreen() {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();

  const selectedModelId = useSelectedModelId();
  const selectedMode = useSelectedTranscriptionMode();
  const setModelId = useSettingsStore((s) => s.setModelId);
  const setTranscriptionMode = useSettingsStore((s) => s.setTranscriptionMode);

  const downloadStore = useModelDownloadStore();
  const [isSaving, setIsSaving] = useState(false);
  const {
    show: showDeleteToast,
    hide: hideDeleteToast,
    toastState: deleteToastState,
  } = useToast();

  const models = getAllModels();

  const handleDownloadRef = useRef<(modelId: ModelId) => void>(() => {});

  const handleSelectModel = useCallback(
    async (modelId: ModelId) => {
      if (modelId === selectedModelId) return;
      if (isSaving) return;

      const info = getModelInfo(modelId);

      // Check if model is available
      if (!info.isBundled && !downloadStore.isDownloaded(modelId)) {
        handleDownloadRef.current(modelId);
        return;
      }

      setIsSaving(true);
      try {
        await setModelId(modelId);
        // If current mode isn't supported by new model, switch to FILE
        if (!info.supportedModes.includes(selectedMode)) {
          await setTranscriptionMode(TranscriptionMode.FILE);
        }
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.settings,
          message: "Failed to set model",
        });
      } finally {
        setIsSaving(false);
      }
    },
    [
      selectedModelId,
      selectedMode,
      isSaving,
      downloadStore,
      setModelId,
      setTranscriptionMode,
    ],
  );

  const handleSelectMode = useCallback(
    async (mode: TranscriptionMode) => {
      if (mode === selectedMode) return;
      try {
        await setTranscriptionMode(mode);
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.settings,
          message: "Failed to set transcription mode",
        });
      }
    },
    [selectedMode, setTranscriptionMode],
  );

  const handleDownload = useCallback(
    async (modelId: ModelId) => {
      const progress = downloadStore.getProgress(modelId);
      if (progress?.status === "downloading") return;

      const success = await downloadStore.startDownload(modelId);
      if (success) {
        // Auto-select the model after download
        try {
          await setModelId(modelId);
        } catch (error) {
          logError(error, {
            flag: FeatureFlag.settings,
            message: "Failed to auto-select downloaded model",
          });
        }
      }
    },
    [downloadStore, setModelId],
  );

  handleDownloadRef.current = handleDownload;

  const handleCancelDownload = useCallback(
    (modelId: ModelId) => {
      downloadStore.cancelDownload(modelId);
    },
    [downloadStore],
  );

  const handleDelete = useCallback(
    (modelId: ModelId) => {
      const info = getModelInfo(modelId);
      showDeleteToast({
        title: loc.modelDeleteConfirmTitle,
        message: loc.modelDeleteConfirmMessage.replace("{{name}}", info.name),
        primaryButtonText: loc.modelDelete,
        onPrimaryButtonTap: async () => {
          hideDeleteToast();
          await downloadStore.deleteModel(modelId);
          if (selectedModelId === modelId) {
            await setModelId(ModelId.WHISPER_TINY);
          }
        },
        secondaryButtonText: loc.modelCancel,
        onSecondaryButtonTap: hideDeleteToast,
        variant: "informative",
      });
    },
    [
      downloadStore,
      selectedModelId,
      setModelId,
      loc,
      showDeleteToast,
      hideDeleteToast,
    ],
  );

  const selectedModelInfo = getModelInfo(selectedModelId);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceBackground },
      ]}
    >
      <TopAppBar title={loc.modelTitle} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + APP_BAR_HEIGHT + 16,
            paddingBottom: insets.bottom + 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text
          variant="body1"
          color={theme.colors.textPrimary}
          style={styles.description}
        >
          {loc.modelDescription}
        </Text>

        {/* Model list */}
        <Card>
          {models.map((model, index) => (
            <View key={model.id}>
              {index > 0 && (
                <Divider color={theme.colors.surfaceBorderPrimary} />
              )}
              <ModelRow
                model={model}
                isSelected={model.id === selectedModelId}
                isDownloaded={
                  model.isBundled || downloadStore.isDownloaded(model.id)
                }
                downloadProgress={downloadStore.getProgress(model.id)}
                onSelect={() => handleSelectModel(model.id)}
                onDownload={() => handleDownload(model.id)}
                onCancelDownload={() => handleCancelDownload(model.id)}
                onDelete={() => handleDelete(model.id)}
                isSaving={isSaving}
              />
            </View>
          ))}
        </Card>

        {/* Transcription mode selector */}
        {selectedModelInfo.supportedModes.length > 1 && (
          <View style={styles.modeSection}>
            <Text
              variant="body2"
              color={theme.colors.textSecondary}
              style={styles.modeLabel}
            >
              {loc.modelModeLabel}
            </Text>
            <Card>
              <ListItem
                testID={TestID.ModelWhisperFile}
                title={loc.modelModeFile}
                titleTrailing={loc.whisperModelFileSubtitle}
                titleTrailingColor={theme.colors.textSecondary}
                iconTrailing={
                  <Radio<TranscriptionMode>
                    value={TranscriptionMode.FILE}
                    groupValue={selectedMode}
                    onValueChange={() =>
                      handleSelectMode(TranscriptionMode.FILE)
                    }
                  />
                }
                onPress={() => handleSelectMode(TranscriptionMode.FILE)}
                backgroundColor={theme.colors.surfacePrimary}
              />
              <Divider color={theme.colors.surfaceBorderPrimary} />
              <ListItem
                testID={TestID.ModelWhisperRealtime}
                title={loc.modelModeRealtime}
                titleTrailing={loc.whisperModelRealtimeSubtitle}
                titleTrailingColor={theme.colors.textSecondary}
                iconTrailing={
                  <Radio<TranscriptionMode>
                    value={TranscriptionMode.REALTIME}
                    groupValue={selectedMode}
                    onValueChange={() =>
                      handleSelectMode(TranscriptionMode.REALTIME)
                    }
                  />
                }
                onPress={() => handleSelectMode(TranscriptionMode.REALTIME)}
                backgroundColor={theme.colors.surfacePrimary}
              />
            </Card>
          </View>
        )}
      </ScrollView>

      <Toast {...deleteToastState} />
    </View>
  );
}

// --- Model Row Component ---

interface ModelRowProps {
  model: ModelInfo;
  isSelected: boolean;
  isDownloaded: boolean;
  downloadProgress: DownloadProgress | undefined;
  onSelect: () => void;
  onDownload: () => void;
  onCancelDownload: () => void;
  onDelete: () => void;
  isSaving: boolean;
}

function ModelRow({
  model,
  isSelected,
  isDownloaded,
  downloadProgress,
  onSelect,
  onDownload,
  onCancelDownload,
  onDelete,
  isSaving,
}: ModelRowProps) {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const isDownloading = downloadProgress?.status === "downloading";
  const hasError = downloadProgress?.status === "error";
  const isSelectable = isDownloaded && !isSaving;

  return (
    <View style={styles.modelRow}>
      <TouchableOpacity
        onPress={isSelectable ? onSelect : undefined}
        disabled={!isSelectable}
        activeOpacity={0.7}
        style={styles.modelRowMain}
      >
        <View style={styles.modelInfo}>
          <View style={styles.modelHeader}>
            <Text
              variant="body1"
              color={theme.colors.textPrimary}
              style={styles.modelName}
            >
              {model.name}
            </Text>
            {isSelected && isDownloaded && (
              <View
                style={[
                  styles.selectedBadge,
                  { backgroundColor: theme.colors.accentBrand },
                ]}
              >
                <Text variant="caption1" color="#FFFFFF">
                  {loc.modelSelected}
                </Text>
              </View>
            )}
          </View>

          <Text
            variant="body2"
            color={theme.colors.textSecondary}
            style={styles.modelDescription}
          >
            {model.description}
          </Text>

          <View style={styles.modelMeta}>
            <Text variant="caption1" color={theme.colors.textTertiary}>
              {formatBytes(model.sizeBytes)}
            </Text>
            <Text variant="caption1" color={theme.colors.textTertiary}>
              {" \u00B7 "}
            </Text>
            <Text variant="caption1" color={theme.colors.textTertiary}>
              {loc.modelLanguageCount.replace(
                "{{count}}",
                String(model.languages),
              )}
            </Text>
            <Text variant="caption1" color={theme.colors.textTertiary}>
              {" \u00B7 "}
            </Text>
            <StatusBadge
              model={model}
              isDownloaded={isDownloaded}
              isDownloading={isDownloading}
              hasError={hasError}
            />
          </View>
        </View>
      </TouchableOpacity>

      {/* Download progress bar */}
      {isDownloading && downloadProgress && (
        <View style={styles.progressSection}>
          <View
            style={[
              styles.progressBarBg,
              { backgroundColor: theme.colors.surfaceBorderPrimary },
            ]}
          >
            <View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: theme.colors.accentBrand,
                  width: `${Math.round(downloadProgress.progress * 100)}%`,
                },
              ]}
            />
          </View>
          <View style={styles.progressRow}>
            <Text variant="caption1" color={theme.colors.textSecondary}>
              {Math.round(downloadProgress.progress * 100)}%{" \u00B7 "}
              {formatBytes(downloadProgress.downloadedBytes)} /{" "}
              {formatBytes(downloadProgress.totalBytes)}
            </Text>
            <TouchableOpacity onPress={onCancelDownload}>
              <Text variant="caption1" color={theme.colors.accentDanger}>
                {loc.modelCancel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Error view */}
      {hasError && downloadProgress && (
        <View style={styles.errorSection}>
          <Text variant="caption1" color={theme.colors.accentDanger}>
            {loc.modelDownloadError.replace(
              "{{error}}",
              downloadProgress.error ?? "Unknown error",
            )}
          </Text>
          <Button.tertiary
            text={loc.modelRetry}
            size="small"
            onPress={onDownload}
          />
        </View>
      )}

      {/* Action buttons */}
      {!isDownloading && !model.isBundled && (
        <View style={styles.actionRow}>
          {!isDownloaded && !hasError && (
            <Button.secondary
              text={loc.modelDownload}
              size="small"
              onPress={onDownload}
            />
          )}
          {isDownloaded && (
            <TouchableOpacity onPress={onDelete}>
              <Text variant="caption1" color={theme.colors.accentDanger}>
                {loc.modelDelete}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// --- Status Badge ---

function StatusBadge({
  model,
  isDownloaded,
  isDownloading,
  hasError,
}: {
  model: ModelInfo;
  isDownloaded: boolean;
  isDownloading: boolean;
  hasError: boolean;
}) {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  if (model.isBundled) {
    return (
      <Text variant="caption1" color={theme.colors.accentBrand}>
        {loc.modelIncluded}
      </Text>
    );
  }
  if (isDownloading) {
    return (
      <Text variant="caption1" color={theme.colors.textTertiary}>
        {loc.modelDownloading}
      </Text>
    );
  }
  if (hasError) {
    return (
      <Text variant="caption1" color={theme.colors.accentDanger}>
        {loc.modelErrorStatus}
      </Text>
    );
  }
  if (isDownloaded) {
    return (
      <Text variant="caption1" color={theme.colors.accentBrand}>
        {loc.modelDownloaded}
      </Text>
    );
  }
  return (
    <Text variant="caption1" color={theme.colors.textTertiary}>
      {loc.modelNotDownloaded}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  description: {
    marginBottom: 16,
  },
  modelRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modelRowMain: {
    flexDirection: "row",
    alignItems: "center",
  },
  modelInfo: {
    flex: 1,
  },
  modelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modelName: {
    fontWeight: "600",
  },
  selectedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  modelDescription: {
    marginTop: 2,
  },
  modelMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  progressSection: {
    marginTop: 8,
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 4,
    borderRadius: 2,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  errorSection: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  actionRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  modeSection: {
    marginTop: 24,
  },
  modeLabel: {
    marginBottom: 8,
  },
});
