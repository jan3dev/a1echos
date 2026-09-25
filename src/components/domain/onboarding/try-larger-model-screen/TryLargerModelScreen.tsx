import { ScrollView, StyleSheet, View } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import {
  useSafeAreaFrame,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useLocalization } from "@/hooks";
import type { ModelInfo } from "@/models";
import type { DownloadProgress } from "@/services";
import { darkColors, spacing } from "@/theme";
import { formatBytes } from "@/utils";

import { Button } from "../../../ui/button/Button";
import { Text } from "../../../ui/text/Text";
import { ModelCard } from "../../settings/model-card/ModelCard";
import { OnboardingHeader } from "../header/OnboardingHeader";

const TRY_LARGER_MODEL_STEP = 4;

export interface TryLargerModelScreenProps {
  model: ModelInfo;
  isDownloaded: boolean;
  isSelected: boolean;
  downloadProgress?: DownloadProgress;
  onDownload: () => void;
  onCancelDownload: () => void;
  onSelect: () => void;
  onBack: () => void;
  onNext: () => void;
  testID?: string;
}

/** Presentational only — downloading, selection and navigation live at the route. */
export const TryLargerModelScreen = ({
  model,
  isDownloaded,
  isSelected,
  downloadProgress,
  onDownload,
  onCancelDownload,
  onSelect,
  onBack,
  onNext,
  testID,
}: TryLargerModelScreenProps) => {
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const landscape = frame.width > frame.height;
  const { loc } = useLocalization();
  const childTestID = (suffix: string) =>
    testID ? `${testID}-${suffix}` : undefined;

  return (
    <View testID={testID} style={styles.root}>
      <SystemBars style="light" />
      <OnboardingHeader
        step={TRY_LARGER_MODEL_STEP}
        onBack={onBack}
        testID={testID}
      />

      <View
        style={[
          styles.content,
          {
            paddingBottom: insets.bottom + spacing.md,
            paddingLeft: insets.left + spacing.md,
            paddingRight: insets.right + spacing.md,
          },
        ]}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.body,
            { paddingTop: landscape ? spacing.sm : spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.copy}>
            <Text
              variant="h4"
              weight="medium"
              align="center"
              color={darkColors.textPrimary}
            >
              {loc.onboardingTryLargerModelTitle}
            </Text>
            <Text
              variant="body1"
              weight="medium"
              align="center"
              color={darkColors.textSecondary}
            >
              {loc.onboardingTryLargerModelSubtitle}
            </Text>
          </View>

          <ModelCard
            testID={childTestID("model")}
            name={model.name}
            description={model.description}
            languageCount={model.languages}
            sizeLabel={formatBytes(model.sizeBytes)}
            isBundled={model.isBundled}
            isSelected={isSelected}
            isDownloaded={isDownloaded}
            supportedModes={model.supportedModes}
            selectedMode={model.supportedModes[0]}
            downloadProgress={downloadProgress}
            onSelect={onSelect}
            onDownload={onDownload}
            onCancelDownload={onCancelDownload}
            onRetry={onDownload}
            highlightDownload
            colors={darkColors}
          />
        </ScrollView>

        {isDownloaded ? (
          <Button.primary
            testID={childTestID("next")}
            text={loc.onboardingNext}
            onPress={onNext}
          />
        ) : (
          <Button.secondary
            testID={childTestID("not-now")}
            text={loc.onboardingNotNow}
            onPress={onNext}
            colors={darkColors}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: darkColors.surfaceBackground,
  },
  content: {
    flex: 1,
    minHeight: 0,
    gap: spacing.md,
  },
  scroll: {
    flex: 1,
  },
  body: {
    gap: spacing.xl,
  },
  copy: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
});
