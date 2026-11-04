import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View, type HostInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppBarBlurTarget,
  LlmCard,
  Screen,
  Text,
  TopAppBar,
} from "@/components";
import { Toast } from "@/components/ui/toast/Toast";
import { useToast } from "@/components/ui/toast/useToast";
import { AppConstants } from "@/constants";
import {
  useEnsureModelDownloaded,
  useLocalization,
  useScrollSurface,
} from "@/hooks";
import { getAllLlms, getLlmInfo, getRecommendedLlmId } from "@/models";
import type { LlmModelId, LlmModelInfo } from "@/models";
import { llmService } from "@/services";
import {
  useModelDownloadStore,
  useSelectedLanguage,
  useSelectedLlmId,
  useSetLlmId,
  useShowGlobalTooltip,
} from "@/stores";
import { useTheme } from "@/theme";
import { formatBytes } from "@/utils";

export default function IntelligenceSettingsScreen() {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<HostInstance>(null);
  const { scrolled, onScroll } = useScrollSurface();

  const selectedLlmId = useSelectedLlmId();
  const isEnglish = useSelectedLanguage().code === "en";
  const setLlmId = useSetLlmId();
  const downloadStore = useModelDownloadStore();
  const showGlobalTooltip = useShowGlobalTooltip();
  const ensureModelDownloaded = useEnsureModelDownloaded();
  const {
    show: showDeleteToast,
    hide: hideDeleteToast,
    toastState: deleteToastState,
  } = useToast();

  const [recommendedId, setRecommendedId] = useState<LlmModelId | null>(null);
  useEffect(() => {
    llmService
      .getTotalRamBytes()
      .then((ram) => ram && setRecommendedId(getRecommendedLlmId(ram)))
      .catch(() => {});
  }, []);

  const models = getAllLlms();
  const { downloadedSection, availableSection } = useMemo(() => {
    const downloaded: LlmModelInfo[] = [];
    const available: LlmModelInfo[] = [];
    for (const model of models) {
      const status = downloadStore.getProgress(model.id)?.status;
      const isActiveDownload = status === "downloading" || status === "error";
      if (downloadStore.isDownloaded(model.id) && !isActiveDownload) {
        downloaded.push(model);
      } else {
        available.push(model);
      }
    }
    return { downloadedSection: downloaded, availableSection: available };
  }, [models, downloadStore]);

  const handleDownload = useCallback(
    async (llmId: LlmModelId) => {
      if (await ensureModelDownloaded(llmId)) {
        await setLlmId(llmId);
      }
    },
    [ensureModelDownloaded, setLlmId],
  );

  const handleDelete = useCallback(
    (llmId: LlmModelId) => {
      showDeleteToast({
        title: loc.deleteConfirmTitle,
        message: loc.deleteConfirmMessage.replace(
          "{{name}}",
          getLlmInfo(llmId).name,
        ),
        primaryButtonText: loc.delete,
        onPrimaryButtonTap: async () => {
          hideDeleteToast();
          if (!(await downloadStore.deleteModel(llmId))) return;
          if (selectedLlmId === llmId) {
            const fallback = models.find(
              (m) => m.id !== llmId && downloadStore.isDownloaded(m.id),
            );
            await setLlmId(fallback?.id ?? null);
          }
          showGlobalTooltip(loc.deletedToast, "normal", 3000);
        },
        secondaryButtonText: loc.cancel,
        onSecondaryButtonTap: hideDeleteToast,
        variant: "info",
      });
    },
    [
      downloadStore,
      models,
      selectedLlmId,
      setLlmId,
      loc,
      showDeleteToast,
      hideDeleteToast,
      showGlobalTooltip,
    ],
  );

  const renderCard = (model: LlmModelInfo) => (
    <LlmCard
      key={model.id}
      testID={`llm-card-${model.id}`}
      name={model.name}
      description={loc.llmDescription(model.id)}
      sizeLabel={formatBytes(model.sizeBytes)}
      isRecommended={model.id === recommendedId}
      warning={
        model.englishOnly && !isEnglish ? loc.llmEnglishOnlyWarning : undefined
      }
      isSelected={model.id === selectedLlmId}
      isDownloaded={downloadStore.isDownloaded(model.id)}
      downloadProgress={downloadStore.getProgress(model.id)}
      onSelect={() => setLlmId(model.id)}
      onDownload={() => handleDownload(model.id)}
      onCancelDownload={() => downloadStore.cancelDownload(model.id)}
      onDelete={() => handleDelete(model.id)}
      onRetry={() => handleDownload(model.id)}
    />
  );

  return (
    <Screen>
      {/* Bars render after content so Android's blur target ref is populated
          before the bar's BlurView mounts and resolves its `blurTarget`. */}
      <AppBarBlurTarget targetRef={blurTargetRef} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + AppConstants.APP_BAR_HEIGHT + 16,
              paddingBottom: insets.bottom + 16,
              backgroundColor: theme.colors.surfaceBackground,
            },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <Text
            variant="body1"
            weight="medium"
            color={theme.colors.textSecondary}
          >
            {loc.intelligenceDescription}
          </Text>

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
      </AppBarBlurTarget>

      <TopAppBar
        title={loc.intelligenceTitle}
        blurTarget={blurTargetRef}
        scrolled={scrolled}
      />

      <Toast {...deleteToastState} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    gap: 24,
  },
  section: {
    gap: 16,
  },
  cardList: {
    gap: 16,
  },
});
