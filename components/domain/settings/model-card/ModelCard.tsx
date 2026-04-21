import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Icon, IconName, Radio, Text } from "@/components/ui";
import { RipplePressable } from "@/components/ui/ripple-pressable/RipplePressable";
import { useLocalization } from "@/hooks";
import { TranscriptionMode } from "@/models";
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
  supportedModes: TranscriptionMode[];
  selectedMode?: TranscriptionMode;
  onSelectMode?: (mode: TranscriptionMode) => void;
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
  supportedModes,
  selectedMode,
  onSelectMode,
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
          <View style={styles.titleLine}>
            <Text
              variant="subtitle"
              weight="medium"
              color={colors.textPrimary}
              numberOfLines={1}
            >
              {name}
            </Text>
            {isBundled && <IncludedChip label={loc.modelIncluded} />}
          </View>
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
              size="large"
            />
          </View>
        )}
      </View>

      {isDownloaded ? (
        <DownloadedBody
          languagesText={languagesText}
          sizeLabel={sizeLabel}
          isBundled={isBundled}
          isSelected={isSelected}
          supportedModes={supportedModes}
          selectedMode={selectedMode}
          onSelectMode={onSelectMode}
          onDelete={onDelete}
          onLanguagesPress={onLanguagesPress}
        />
      ) : isDownloading && downloadProgress ? (
        <DownloadProgressSection
          progress={downloadProgress}
          onCancel={onCancelDownload}
          languagesText={languagesText}
          supportedModes={supportedModes}
          onLanguagesPress={onLanguagesPress}
        />
      ) : hasError ? (
        <ErrorSection
          languagesText={languagesText}
          supportedModes={supportedModes}
          onRetry={onRetry}
          onLanguagesPress={onLanguagesPress}
        />
      ) : (
        <AvailableBody
          languagesText={languagesText}
          sizeLabel={sizeLabel}
          supportedModes={supportedModes}
          onDownload={onDownload}
          onLanguagesPress={onLanguagesPress}
        />
      )}
    </RipplePressable>
  );
};

// --- Downloaded (meta + mode selector) ---

interface DownloadedBodyProps {
  languagesText: string;
  sizeLabel: string;
  isBundled: boolean;
  isSelected: boolean;
  supportedModes: TranscriptionMode[];
  selectedMode?: TranscriptionMode;
  onSelectMode?: (mode: TranscriptionMode) => void;
  onDelete?: () => void;
  onLanguagesPress?: () => void;
}

function DownloadedBody({
  languagesText,
  sizeLabel,
  isBundled,
  isSelected,
  supportedModes,
  selectedMode,
  onSelectMode,
  onDelete,
  onLanguagesPress,
}: DownloadedBodyProps) {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const { colors } = theme;

  const showDelete = !isBundled && !isSelected;

  return (
    <>
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

        {showDelete && onDelete && (
          <ActionButton
            icon="trash"
            label={loc.modelDelete}
            color={colors.accentDanger}
            onPress={onDelete}
          />
        )}
      </View>

      <View
        style={[
          styles.divider,
          { backgroundColor: colors.surfaceBorderPrimary },
        ]}
      />

      <ModeSelector
        supportedModes={supportedModes}
        selectedMode={selectedMode}
        onSelectMode={onSelectMode}
      />
    </>
  );
}

// --- Available (not downloaded, idle) ---

interface AvailableBodyProps {
  languagesText: string;
  sizeLabel: string;
  supportedModes: TranscriptionMode[];
  onDownload?: () => void;
  onLanguagesPress?: () => void;
}

function AvailableBody({
  languagesText,
  sizeLabel,
  supportedModes,
  onDownload,
  onLanguagesPress,
}: AvailableBodyProps) {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const { colors } = theme;

  return (
    <>
      <ModeMetaRow
        languagesText={languagesText}
        supportedModes={supportedModes}
        onLanguagesPress={onLanguagesPress}
      />

      <View
        style={[
          styles.divider,
          { backgroundColor: colors.surfaceBorderPrimary },
        ]}
      />

      <View style={styles.footerRow}>
        <Text variant="caption1" weight="medium" color={colors.textSecondary}>
          {sizeLabel}
        </Text>
        {onDownload && (
          <ActionButton
            icon="download"
            label={loc.modelDownload}
            color={colors.accentBrand}
            onPress={onDownload}
          />
        )}
      </View>
    </>
  );
}

// --- Downloading progress ---

interface DownloadProgressSectionProps {
  progress: DownloadProgress;
  onCancel?: () => void;
  languagesText: string;
  supportedModes: TranscriptionMode[];
  onLanguagesPress?: () => void;
}

function DownloadProgressSection({
  progress,
  onCancel,
  languagesText,
  supportedModes,
  onLanguagesPress,
}: DownloadProgressSectionProps) {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const { colors } = theme;

  const percent = Math.round(progress.progress * 100);

  return (
    <View style={styles.progressSection}>
      <ModeMetaRow
        languagesText={languagesText}
        supportedModes={supportedModes}
        onLanguagesPress={onLanguagesPress}
      />

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
          <ActionButton
            icon="close_circle"
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
  supportedModes: TranscriptionMode[];
  onRetry?: () => void;
  onLanguagesPress?: () => void;
}

function ErrorSection({
  languagesText,
  supportedModes,
  onRetry,
  onLanguagesPress,
}: ErrorSectionProps) {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const { colors } = theme;

  return (
    <View style={styles.errorSection}>
      <ModeMetaRow
        languagesText={languagesText}
        supportedModes={supportedModes}
        onLanguagesPress={onLanguagesPress}
      />
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
          <ActionButton
            icon="rotate_left"
            label={loc.modelTryAgain}
            color={colors.accentBrand}
            onPress={onRetry}
          />
        )}
      </View>
    </View>
  );
}

// --- Mode selector (downloaded bottom row) ---

interface ModeSelectorProps {
  supportedModes: TranscriptionMode[];
  selectedMode?: TranscriptionMode;
  onSelectMode?: (mode: TranscriptionMode) => void;
}

function ModeSelector({
  supportedModes,
  selectedMode,
  onSelectMode,
}: ModeSelectorProps) {
  const { loc } = useLocalization();

  const hasRealtime = supportedModes.includes(TranscriptionMode.REALTIME);
  const hasFile = supportedModes.includes(TranscriptionMode.FILE);

  if (hasRealtime && hasFile) {
    return (
      <View style={styles.modeRow}>
        <ModeSelectorChip
          icon="flash"
          label={loc.modelModeRealtime}
          active={selectedMode === TranscriptionMode.REALTIME}
          onPress={
            onSelectMode
              ? () => onSelectMode(TranscriptionMode.REALTIME)
              : undefined
          }
        />
        <ModeSelectorChip
          icon="timer"
          label={loc.modelModeHighAccuracy}
          active={selectedMode === TranscriptionMode.FILE}
          onPress={
            onSelectMode
              ? () => onSelectMode(TranscriptionMode.FILE)
              : undefined
          }
        />
      </View>
    );
  }

  if (hasRealtime) {
    return (
      <ModeSelectorChip
        icon="flash"
        label={loc.modelModeRealtimeOnly}
        active
        fullWidth
      />
    );
  }

  return (
    <ModeSelectorChip
      icon="timer"
      label={loc.modelModeHighAccuracyOnly}
      active
      fullWidth
    />
  );
}

function ModeSelectorChip({
  icon,
  label,
  active,
  fullWidth,
  onPress,
}: {
  icon: IconName;
  label: string;
  active: boolean;
  fullWidth?: boolean;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const { colors } = theme;

  const backgroundColor = active
    ? colors.accentBrandTransparent
    : colors.surfaceBorderPrimary;
  const labelColor = active ? colors.accentBrand : colors.textSecondary;
  const borderColor = active ? colors.surfaceBorderSelected : "transparent";

  const content = (
    <>
      <Icon name={icon} size={18} color={labelColor} />
      <Text variant="body2" weight="medium" color={labelColor}>
        {label}
      </Text>
    </>
  );

  const chipStyle = [
    styles.modeChip,
    fullWidth ? styles.modeChipFullWidth : styles.modeChipFlex,
    { backgroundColor, borderColor },
  ];

  if (!onPress) {
    return <View style={chipStyle}>{content}</View>;
  }

  return (
    <RipplePressable
      onPress={onPress}
      rippleColor={colors.ripple}
      style={({ pressed }) => [chipStyle, { opacity: iosPressed(pressed) }]}
    >
      {content}
    </RipplePressable>
  );
}

// --- Inline mode meta (not-downloaded) ---

function ModeMetaRow({
  languagesText,
  supportedModes,
  onLanguagesPress,
}: {
  languagesText: string;
  supportedModes: TranscriptionMode[];
  onLanguagesPress?: () => void;
}) {
  const { loc } = useLocalization();

  const hasRealtime = supportedModes.includes(TranscriptionMode.REALTIME);
  const hasFile = supportedModes.includes(TranscriptionMode.FILE);
  const isSingleMode = supportedModes.length === 1;

  return (
    <View style={styles.metaWrapRow}>
      <LanguagesChip languagesText={languagesText} onPress={onLanguagesPress} />
      {hasRealtime && (
        <>
          <MetaDivider />
          <ModeMetaChip
            icon="flash"
            label={
              isSingleMode ? loc.modelModeRealtimeOnly : loc.modelModeRealtime
            }
          />
        </>
      )}
      {hasFile && (
        <>
          <MetaDivider />
          <ModeMetaChip
            icon="timer"
            label={
              isSingleMode
                ? loc.modelModeHighAccuracyOnly
                : loc.modelModeHighAccuracy
            }
          />
        </>
      )}
    </View>
  );
}

function ModeMetaChip({ icon, label }: { icon: IconName; label: string }) {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View style={styles.actionCluster}>
      <Icon name={icon} size={18} color={colors.textTertiary} />
      <Text variant="caption1" weight="medium" color={colors.textTertiary}>
        {label}
      </Text>
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

function IncludedChip({ label }: { label: string }) {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View
      style={[
        styles.includedChip,
        { backgroundColor: colors.accentBrandTransparent },
      ]}
    >
      <Text variant="caption1" weight="medium" color={colors.accentBrand}>
        {label}
      </Text>
    </View>
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
    overflow: "hidden",
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
  titleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  includedChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 300,
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
  metaWrapRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
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
  divider: {
    height: 1,
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
  },
  modeChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  modeChipFlex: {
    flex: 1,
  },
  modeChipFullWidth: {
    alignSelf: "stretch",
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
