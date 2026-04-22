import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ModelCard, Text, TopAppBar } from "@/components";
import { Toast } from "@/components/ui/toast/Toast";
import { useToast } from "@/components/ui/toast/useToast";
import { AppConstants, Routes } from "@/constants";
import { useLocalization } from "@/hooks";
import type { ModelInfo } from "@/models";
import {
  ModelId,
  TranscriptionMode,
  getAllModels,
  getModelInfo,
} from "@/models";
import {
  useModelDownloadStore,
  useModelModes,
  useSelectedModelId,
  useSettingsStore,
  useShowGlobalTooltip,
} from "@/stores";
import { modelDownloadService } from "@/services/ModelDownloadService";
import { useTheme } from "@/theme";
import { FeatureFlag, formatBytes, logError } from "@/utils";

export default function ModelSettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();

  const selectedModelId = useSelectedModelId();
  const modelModes = useModelModes();
  const setModelId = useSettingsStore((s) => s.setModelId);
  const setModelMode = useSettingsStore((s) => s.setModelMode);

  const downloadStore = useModelDownloadStore();
  const showGlobalTooltip = useShowGlobalTooltip();
  const [isSaving, setIsSaving] = useState(false);
  const {
    show: showDeleteToast,
    hide: hideDeleteToast,
    toastState: deleteToastState,
  } = useToast();

  const models = getAllModels();
  const { downloadedSection, availableSection } = useMemo(() => {
    const downloaded: ModelInfo[] = [];
    const available: ModelInfo[] = [];
    for (const model of models) {
      const progress = downloadStore.getProgress(model.id);
      const isActiveDownload =
        progress?.status === "downloading" || progress?.status === "error";
      if (
        (model.isBundled || downloadStore.isDownloaded(model.id)) &&
        !isActiveDownload
      ) {
        downloaded.push(model);
      } else {
        available.push(model);
      }
    }
    return { downloadedSection: downloaded, availableSection: available };
  }, [models, downloadStore]);

  const handleDownload = useCallback(
    async (modelId: ModelId) => {
      const progress = downloadStore.getProgress(modelId);
      if (progress?.status === "downloading") return;

      const diskCheck = await modelDownloadService.checkDiskSpace(modelId);
      if (!diskCheck.sufficient) {
        showGlobalTooltip(
          loc.insufficientSpace(
            formatBytes(diskCheck.required),
            formatBytes(diskCheck.available),
          ),
          "warning",
          5000,
        );
        return;
      }

      const success = await downloadStore.startDownload(modelId);
      if (success) {
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
    [downloadStore, setModelId, loc, showGlobalTooltip],
  );

  const handleSelectModel = useCallback(
    async (modelId: ModelId) => {
      if (modelId === selectedModelId) return;
      if (isSaving) return;

      const info = getModelInfo(modelId);
      if (!info.isBundled && !downloadStore.isDownloaded(modelId)) {
        handleDownload(modelId);
        return;
      }

      setIsSaving(true);
      try {
        await setModelId(modelId);
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.settings,
          message: "Failed to set model",
        });
      } finally {
        setIsSaving(false);
      }
    },
    [selectedModelId, isSaving, downloadStore, setModelId, handleDownload],
  );

  const handleSelectMode = useCallback(
    async (modelId: ModelId, mode: TranscriptionMode) => {
      try {
        await setModelMode(modelId, mode);
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.settings,
          message: "Failed to set transcription mode",
        });
      }
    },
    [setModelMode],
  );

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
        title: loc.deleteConfirmTitle,
        message: loc.deleteConfirmMessage.replace("{{name}}", info.name),
        primaryButtonText: loc.delete,
        onPrimaryButtonTap: async () => {
          hideDeleteToast();
          const success = await downloadStore.deleteModel(modelId);
          if (selectedModelId === modelId) {
            await setModelId(ModelId.WHISPER_TINY);
          }
          if (success) {
            showGlobalTooltip(loc.deletedToast, "normal", 3000);
          }
        },
        secondaryButtonText: loc.cancel,
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
      showGlobalTooltip,
    ],
  );

  const handleOpenLanguages = useCallback(
    (modelId: ModelId) => {
      router.push(Routes.settingsModelLanguages(modelId));
    },
    [router],
  );

  const renderCard = (model: ModelInfo) => {
    const progress = downloadStore.getProgress(model.id);
    const isDownloaded =
      model.isBundled || downloadStore.isDownloaded(model.id);
    const isSelectedCard = model.id === selectedModelId;
    const savedMode = modelModes[model.id];
    const cardMode =
      savedMode && model.supportedModes.includes(savedMode)
        ? savedMode
        : model.supportedModes[0];
    return (
      <ModelCard
        key={model.id}
        testID={`model-card-${model.id}`}
        name={model.name}
        description={model.description}
        languageCount={model.languages}
        sizeLabel={formatBytes(model.sizeBytes)}
        isBundled={model.isBundled}
        isSelected={isSelectedCard}
        isDownloaded={isDownloaded}
        supportedModes={model.supportedModes}
        selectedMode={cardMode}
        onSelectMode={(mode) => handleSelectMode(model.id, mode)}
        downloadProgress={progress}
        onSelect={() => handleSelectModel(model.id)}
        onDownload={() => handleDownload(model.id)}
        onCancelDownload={() => handleCancelDownload(model.id)}
        onDelete={() => handleDelete(model.id)}
        onRetry={() => handleDownload(model.id)}
        onLanguagesPress={() => handleOpenLanguages(model.id)}
        disabled={isSaving}
      />
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceBackground },
      ]}
    >
      <TopAppBar title="" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + AppConstants.APP_BAR_HEIGHT + 16,
            paddingBottom: insets.bottom + 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text variant="h4" weight="semibold" color={theme.colors.textPrimary}>
            {loc.title}
          </Text>
          <Text
            variant="body1"
            weight="medium"
            color={theme.colors.textSecondary}
          >
            {loc.description}
          </Text>
        </View>

        {downloadedSection.length > 0 && (
          <View style={styles.section}>
            <Text
              variant="body2"
              weight="medium"
              color={theme.colors.textSecondary}
            >
              {loc.sectionDownloaded}
            </Text>
            <View style={styles.cardList}>
              {downloadedSection.map(renderCard)}
            </View>
          </View>
        )}

        {availableSection.length > 0 && (
          <View style={styles.section}>
            <Text
              variant="body2"
              weight="medium"
              color={theme.colors.textSecondary}
            >
              {loc.sectionAvailable}
            </Text>
            <View style={styles.cardList}>
              {availableSection.map(renderCard)}
            </View>
          </View>
        )}
      </ScrollView>

      <Toast {...deleteToastState} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 24,
  },
  header: {
    gap: 8,
  },
  section: {
    gap: 8,
  },
  cardList: {
    gap: 8,
  },
});
