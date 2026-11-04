import { StyleSheet, View } from "react-native";

import { Icon, Text } from "@/components/ui";
import { useLocalization } from "@/hooks";
import type { DownloadProgress } from "@/services";
import { AquaColors, useTheme } from "@/theme";

import {
  ActionButton,
  AvailableSection,
  DownloadErrorSection,
  DownloadProgressSection,
  MetaDivider,
  ModelCardFrame,
  useCardColors,
} from "../model-card/ModelCard";

interface LlmCardProps {
  name: string;
  description: string;
  sizeLabel: string;
  /** Best fit for this device's RAM: badge, plus a pulsing Download. */
  isRecommended?: boolean;
  /** Shown above the footer, e.g. a language this model handles poorly. */
  warning?: string;
  isSelected: boolean;
  isDownloaded: boolean;
  downloadProgress?: DownloadProgress;
  onSelect?: () => void;
  onDownload?: () => void;
  onCancelDownload?: () => void;
  onDelete?: () => void;
  onRetry?: () => void;
  disabled?: boolean;
  colors?: AquaColors;
  testID?: string;
}

export const LlmCard = ({
  name,
  description,
  sizeLabel,
  isRecommended,
  warning,
  isSelected,
  isDownloaded,
  downloadProgress,
  onSelect,
  onDownload,
  onCancelDownload,
  onDelete,
  onRetry,
  disabled,
  colors: colorsOverride,
  testID,
}: LlmCardProps) => {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const colors = colorsOverride ?? theme.colors;

  const isDownloading = downloadProgress?.status === "downloading";
  const hasError = downloadProgress?.status === "error";
  const canSelect = isDownloaded && !disabled && !isDownloading;
  const meta = <CapabilitiesRow />;

  return (
    <ModelCardFrame
      testID={testID}
      name={name}
      description={description}
      badge={isRecommended ? loc.recommended : undefined}
      isSelected={isSelected}
      showRadio={isDownloaded && !isDownloading}
      canSelect={canSelect}
      onSelect={onSelect}
      colors={colors}
    >
      {warning && (
        <View style={styles.warning}>
          <Icon name="warning" size={18} color={colors.accentWarning} />
          <Text
            variant="caption1"
            weight="medium"
            color={colors.textSecondary}
            style={styles.warningText}
          >
            {warning}
          </Text>
        </View>
      )}
      {isDownloaded ? (
        <DownloadedFooter sizeLabel={sizeLabel} onDelete={onDelete} />
      ) : isDownloading && downloadProgress ? (
        <DownloadProgressSection
          meta={meta}
          progress={downloadProgress}
          onCancel={onCancelDownload}
        />
      ) : hasError ? (
        <DownloadErrorSection meta={meta} onRetry={onRetry} />
      ) : (
        <AvailableSection
          meta={meta}
          sizeLabel={sizeLabel}
          onDownload={onDownload}
          highlightDownload={isRecommended}
        />
      )}
    </ModelCardFrame>
  );
};

function DownloadedFooter({
  sizeLabel,
  onDelete,
}: {
  sizeLabel: string;
  onDelete?: () => void;
}) {
  const colors = useCardColors();
  const { loc } = useLocalization();

  return (
    <View style={styles.row}>
      <View style={styles.meta}>
        <Text variant="caption1" weight="medium" color={colors.textTertiary}>
          {loc.llmCapabilitiesSummary}
        </Text>
        <MetaDivider />
        <Text variant="caption1" weight="medium" color={colors.textTertiary}>
          {sizeLabel}
        </Text>
      </View>
      {onDelete && (
        <ActionButton
          icon="trash"
          label={loc.delete}
          color={colors.accentDanger}
          onPress={onDelete}
        />
      )}
    </View>
  );
}

function CapabilitiesRow() {
  const { loc } = useLocalization();
  return (
    <View style={styles.meta}>
      <Capability label={loc.llmCapabilitySummarization} />
      <MetaDivider />
      <Capability label={loc.llmCapabilityTextCleanup} />
    </View>
  );
}

function Capability({ label }: { label: string }) {
  const colors = useCardColors();
  return (
    <View style={styles.capability}>
      <Icon name="check" size={18} color={colors.textSecondary} />
      <Text variant="caption1" weight="medium" color={colors.textTertiary}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
  },
  warningText: {
    flex: 1,
  },
  capability: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
