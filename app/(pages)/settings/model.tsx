import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Card,
  Divider,
  ListItem,
  ModelCard,
  Radio,
  Text,
  TopAppBar,
} from "@/components";
import { Toast } from "@/components/ui/toast/Toast";
import { useToast } from "@/components/ui/toast/useToast";
import { AppConstants, Routes, TestID } from "@/constants";
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
  useSelectedModelId,
  useSelectedTranscriptionMode,
  useSettingsStore,
  useShowGlobalTooltip,
} from "@/stores";
import { useTheme } from "@/theme";
import { FeatureFlag, logError } from "@/utils";

const formatSize = (bytes: number): string => {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  return `${Math.round(bytes / 1_000_000)} MB`;
};

export default function ModelSettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();

  const selectedModelId = useSelectedModelId();
  const selectedMode = useSelectedTranscriptionMode();
  const setModelId = useSettingsStore((s) => s.setModelId);
  const setTranscriptionMode = useSettingsStore((s) => s.setTranscriptionMode);

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
    [downloadStore, setModelId],
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
      handleDownload,
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
          const success = await downloadStore.deleteModel(modelId);
          if (selectedModelId === modelId) {
            await setModelId(ModelId.WHISPER_TINY);
          }
          if (success) {
            showGlobalTooltip(loc.modelDeletedToast, "normal", 3000);
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
      showGlobalTooltip,
    ],
  );

  const handleOpenLanguages = useCallback(
    (modelId: ModelId) => {
      router.push(Routes.settingsModelLanguages(modelId));
    },
    [router],
  );

  const selectedModelInfo = getModelInfo(selectedModelId);

  const renderCard = (model: ModelInfo) => {
    const progress = downloadStore.getProgress(model.id);
    const isDownloaded =
      model.isBundled || downloadStore.isDownloaded(model.id);
    return (
      <ModelCard
        key={model.id}
        testID={`model-card-${model.id}`}
        name={model.name}
        description={model.description}
        languageCount={model.languages}
        sizeLabel={formatSize(model.sizeBytes)}
        isBundled={model.isBundled}
        isSelected={model.id === selectedModelId}
        isDownloaded={isDownloaded}
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
            {loc.modelTitle}
          </Text>
          <Text
            variant="body1"
            weight="medium"
            color={theme.colors.textSecondary}
          >
            {loc.modelDescription}
          </Text>
        </View>

        {downloadedSection.length > 0 && (
          <View style={styles.section}>
            <Text
              variant="body2"
              weight="medium"
              color={theme.colors.textSecondary}
            >
              {loc.modelSectionDownloaded}
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
              {loc.modelSectionAvailable}
            </Text>
            <View style={styles.cardList}>
              {availableSection.map(renderCard)}
            </View>
          </View>
        )}

        {selectedModelInfo.supportedModes.length > 1 && (
          <View style={styles.modeSection}>
            <Text
              variant="body2"
              weight="medium"
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
  modeSection: {
    marginTop: 8,
  },
  modeLabel: {
    marginBottom: 8,
  },
});
