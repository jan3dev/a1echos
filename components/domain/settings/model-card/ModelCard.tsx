import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Icon, IconName, Radio, Text } from "@/components/ui";
import { RipplePressable } from "@/components/ui/ripple-pressable/RipplePressable";
import { useLocalization } from "@/hooks";
import type { DownloadProgress } from "@/services/ModelDownloadService";
import { AquaColors, useTheme } from "@/theme";
import { formatBytes, iosPressed } from "@/utils";

interface ModelCardProps {
  name: string;
  description: string;
  languageCount: number;
  sizeLabel: string;
  isBundled: boolean;
  isSelected: boolean;
  isDownloaded: boolean;
  downloadProgress?: DownloadProgress;
  onSelect?: () => void;
  onDownload?: () => void;
  onCancelDownload?: () => void;
  onDelete?: () => void;
  onRetry?: () => void;
  onLanguagesPress?: () => void;
  disabled?: boolean;
  testID?: string;
}

export const ModelCard = ({
  name,
  description,
  languageCount,
  sizeLabel,
  isBundled,
  isSelected,
  isDownloaded,
  downloadProgress,
  onSelect,
  onDownload,
  onCancelDownload,
  onDelete,
  onRetry,
  onLanguagesPress,
  disabled,
  testID,
}: ModelCardProps) => {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const { colors } = theme;

  const isDownloading = downloadProgress?.status === "downloading";
  const hasError = downloadProgress?.status === "error";

  const borderColor = isSelected
    ? colors.surfaceBorderSelected
    : colors.surfaceBorderPrimary;

  const canSelect = isDownloaded && !disabled && !isDownloading;

  const languagesText = loc.modelLanguageCount(languageCount);

  return (
    <RipplePressable
      testID={testID}
      onPress={canSelect ? onSelect : undefined}
      disabled={!canSelect}
      rippleColor={colors.ripple}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surfacePrimary,
          borderColor,
          opacity: canSelect ? iosPressed(pressed) : 1,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text
            variant="subtitle"
            weight="medium"
            color={colors.textPrimary}
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text
            variant="body2"
            weight="medium"
            color={colors.textSecondary}
            numberOfLines={2}
          >
            {description}
          </Text>
        </View>

        {isDownloaded && !isDownloading && (
          <View style={styles.radioWrapper}>
            <Radio<boolean>
              value={true}
              groupValue={isSelected}
              onValueChange={canSelect ? onSelect : undefined}
              enabled={canSelect}
              size="small"
            />
          </View>
        )}
      </View>

      {isDownloading && downloadProgress ? (
        <DownloadProgressSection
          progress={downloadProgress}
          onCancel={onCancelDownload}
          languagesText={languagesText}
        />
      ) : hasError ? (
        <ErrorSection
          languagesText={languagesText}
          sizeLabel={sizeLabel}
          onRetry={onRetry}
          onLanguagesPress={onLanguagesPress}
        />
      ) : (
        <FooterRow
          languagesText={languagesText}
          sizeLabel={sizeLabel}
          isBundled={isBundled}
          isDownloaded={isDownloaded}
          isSelected={isSelected}
          onDownload={onDownload}
          onDelete={onDelete}
          onLanguagesPress={onLanguagesPress}
        />
      )}
    </RipplePressable>
  );
};

// --- Footer (default/downloaded/not-downloaded) ---

interface FooterRowProps {
  languagesText: string;
  sizeLabel: string;
  isBundled: boolean;
  isDownloaded: boolean;
  isSelected: boolean;
  onDownload?: () => void;
  onDelete?: () => void;
  onLanguagesPress?: () => void;
}

function FooterRow({
  languagesText,
  sizeLabel,
  isBundled,
  isDownloaded,
  isSelected,
  onDownload,
  onDelete,
  onLanguagesPress,
}: FooterRowProps) {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const { colors } = theme;

  const showDelete = isDownloaded && !isBundled && !isSelected;
  const showDownload = !isDownloaded && !isBundled;

  return (
    <View style={styles.footerRow}>
      <View style={styles.footerMeta}>
        <LanguagesChip
          languagesText={languagesText}
          onPress={onLanguagesPress}
        />
        {!isBundled && (
          <>
            <MetaDivider />
            <Text
              variant="caption1"
              weight="medium"
              color={colors.textTertiary}
            >
              {sizeLabel}
            </Text>
          </>
        )}
        {isBundled && (
          <>
            <MetaDivider />
            <View style={styles.actionCluster}>
              <Icon name="check" size={18} color={colors.textTertiary} />
              <Text
                variant="caption1"
                weight="medium"
                color={colors.textTertiary}
              >
                {loc.modelIncluded}
              </Text>
            </View>
          </>
        )}
      </View>

      {showDownload && onDownload && (
        <ActionButton
          icon="download"
          label={loc.modelDownload}
          color={colors.accentBrand}
          onPress={onDownload}
        />
      )}

      {showDelete && onDelete && (
        <ActionButton
          icon="trash"
          label={loc.modelDelete}
          color={colors.accentDanger}
          onPress={onDelete}
        />
      )}
    </View>
  );
}

// --- Downloading progress ---

interface DownloadProgressSectionProps {
  progress: DownloadProgress;
  onCancel?: () => void;
  languagesText: string;
}

function DownloadProgressSection({
  progress,
  onCancel,
  languagesText,
}: DownloadProgressSectionProps) {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const { colors } = theme;

  const percent = Math.round(progress.progress * 100);

  return (
    <View style={styles.progressSection}>
      <View style={styles.footerMeta}>
        <LanguagesChip languagesText={languagesText} />
      </View>

      <View
        style={[
          styles.progressBarBg,
          { backgroundColor: colors.accentBrandTransparent },
        ]}
      >
        <View
          style={[
            styles.progressBarFill,
            {
              backgroundColor: colors.accentBrand,
              width: `${percent}%`,
            },
          ]}
        />
      </View>

      <View style={styles.progressRow}>
        <View style={styles.progressMeta}>
          <Text variant="caption1" weight="medium" color={colors.textPrimary}>
            {percent}%
          </Text>
          <MetaDivider />
          <Text variant="caption1" weight="medium" color={colors.textSecondary}>
            {formatBytes(progress.downloadedBytes)} /{" "}
            {formatBytes(progress.totalBytes)}
          </Text>
        </View>
        {onCancel && (
          <TextActionButton
            label={loc.modelCancel}
            color={colors.accentDanger}
            onPress={onCancel}
          />
        )}
      </View>
    </View>
  );
}

// --- Error section ---

interface ErrorSectionProps {
  languagesText: string;
  sizeLabel: string;
  onRetry?: () => void;
  onLanguagesPress?: () => void;
}

function ErrorSection({
  languagesText,
  sizeLabel,
  onRetry,
  onLanguagesPress,
}: ErrorSectionProps) {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const { colors } = theme;

  return (
    <View style={styles.errorSection}>
      <View style={styles.footerRow}>
        <View style={styles.footerMeta}>
          <LanguagesChip
            languagesText={languagesText}
            onPress={onLanguagesPress}
          />
          <MetaDivider />
          <Text variant="caption1" weight="medium" color={colors.textTertiary}>
            {sizeLabel}
          </Text>
        </View>
      </View>
      <View
        style={[
          styles.errorBar,
          { backgroundColor: colors.surfaceBorderPrimary },
        ]}
      />
      <View style={styles.progressRow}>
        <Text variant="caption1" weight="medium" color={colors.accentWarning}>
          {loc.modelDownloadFailed}
        </Text>
        {onRetry && (
          <TextActionButton
            label={loc.modelTryAgain}
            color={colors.accentBrand}
            onPress={onRetry}
          />
        )}
      </View>
    </View>
  );
}

// --- Shared primitives ---

function ActionButton({
  icon,
  label,
  color,
  onPress,
}: {
  icon: IconName;
  label: string;
  color: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <PressableCluster
      onPress={onPress}
      style={styles.actionCluster}
      rippleColor={theme.colors.ripple}
    >
      <Icon name={icon} size={18} color={color} />
      <Text variant="body2" weight="semibold" color={color}>
        {label}
      </Text>
    </PressableCluster>
  );
}

function TextActionButton({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <PressableCluster onPress={onPress} rippleColor={theme.colors.ripple}>
      <Text variant="body2" weight="semibold" color={color}>
        {label}
      </Text>
    </PressableCluster>
  );
}

function LanguagesChip({
  languagesText,
  onPress,
}: {
  languagesText: string;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const { colors } = theme;

  const content = (
    <View style={styles.actionCluster}>
      <Icon name="globe" size={18} color={colors.accentBrand} />
      <Text variant="caption1" weight="medium" color={colors.accentBrand}>
        {languagesText}
      </Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <PressableCluster onPress={onPress} rippleColor={colors.ripple}>
      {content}
    </PressableCluster>
  );
}

function PressableCluster({
  onPress,
  rippleColor,
  style,
  children,
}: {
  onPress: () => void;
  rippleColor: AquaColors["ripple"];
  style?: object;
  children: ReactNode;
}) {
  return (
    <RipplePressable
      onPress={onPress}
      rippleColor={rippleColor}
      borderless
      hitSlop={8}
      style={({ pressed }) => [style, { opacity: iosPressed(pressed) }]}
    >
      {children}
    </RipplePressable>
  );
}

function MetaDivider() {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.metaDivider,
        { backgroundColor: theme.colors.surfaceBorderPrimary },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  radioWrapper: {
    marginTop: 2,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  footerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaDivider: {
    width: 1,
    height: 12,
  },
  progressSection: {
    gap: 12,
  },
  progressBarBg: {
    height: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 4,
    borderRadius: 8,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  progressMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorSection: {
    gap: 12,
  },
  errorBar: {
    height: 1,
  },
});
