import { createContext, ReactNode, useContext, useEffect } from "react";
import { StyleSheet, TextStyle, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import {
  Chip,
  DownloadProgressBar,
  Icon,
  IconName,
  Radio,
  Text,
} from "@/components/ui";
import { RipplePressable } from "@/components/ui/ripple-pressable/RipplePressable";
import { useLocalization } from "@/hooks";
import { TranscriptionMode } from "@/models";
import type { DownloadProgress } from "@/services";
import { AquaColors, useTheme } from "@/theme";
import { formatBytes, iosPressed } from "@/utils";

const ATTENTION_FLOAT = 3;

// Always provided by ModelCard, which resolves the override against the theme.
const CardColorsContext = createContext<AquaColors | null>(null);

const useCardColors = () => useContext(CardColorsContext)!;

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
  /** Floats and pulses the Download action to invite a tap. */
  highlightDownload?: boolean;
  /** Pins colors on screens that ignore the app theme. */
  colors?: AquaColors;
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
  highlightDownload,
  colors: colorsOverride,
  testID,
}: ModelCardProps) => {
  const { theme } = useTheme();
  const colors = colorsOverride ?? theme.colors;
  const { loc } = useLocalization();

  const isDownloading = downloadProgress?.status === "downloading";
  const hasError = downloadProgress?.status === "error";

  const borderColor = isSelected
    ? colors.surfaceBorderSelected
    : colors.surfaceBorderPrimary;

  const canSelect = isDownloaded && !disabled && !isDownloading;

  const languagesText = loc.languageCount(languageCount);

  return (
    <CardColorsContext.Provider value={colors}>
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
              {isBundled && <Chip size="small" label={loc.included} />}
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
                size="small"
                colors={colors}
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
            highlightDownload={highlightDownload}
            onLanguagesPress={onLanguagesPress}
          />
        )}
      </RipplePressable>
    </CardColorsContext.Provider>
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
  const colors = useCardColors();
  const { loc } = useLocalization();

  const showDelete = !isBundled;

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
            label={loc.delete}
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
  highlightDownload?: boolean;
  onLanguagesPress?: () => void;
}

function AvailableBody({
  languagesText,
  sizeLabel,
  supportedModes,
  onDownload,
  highlightDownload,
  onLanguagesPress,
}: AvailableBodyProps) {
  const colors = useCardColors();
  const { loc } = useLocalization();

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
            label={loc.download}
            color={colors.accentBrand}
            onPress={onDownload}
            attention={highlightDownload}
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
  const colors = useCardColors();
  const { loc } = useLocalization();

  const percent = Math.round(progress.progressRatio * 100);

  return (
    <View style={styles.progressSection}>
      <ModeMetaRow
        languagesText={languagesText}
        supportedModes={supportedModes}
        onLanguagesPress={onLanguagesPress}
      />

      <DownloadProgressBar ratio={progress.progressRatio} colors={colors} />

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
            label={loc.cancel}
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
  const colors = useCardColors();
  const { loc } = useLocalization();

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
          {loc.downloadFailed}
        </Text>
        {onRetry && (
          <ActionButton
            icon="rotate_left"
            label={loc.tryAgain}
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
          label={loc.realtime}
          active={selectedMode === TranscriptionMode.REALTIME}
          onPress={
            onSelectMode
              ? () => onSelectMode(TranscriptionMode.REALTIME)
              : undefined
          }
        />
        <ModeSelectorChip
          icon="timer"
          label={loc.highAccuracy}
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
        label={loc.realtimeOnly}
        active
        fullWidth
      />
    );
  }

  return (
    <ModeSelectorChip
      icon="timer"
      label={loc.highAccuracyOnly}
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
  const colors = useCardColors();

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
            label={isSingleMode ? loc.realtimeOnly : loc.realtime}
          />
        </>
      )}
      {hasFile && (
        <>
          <MetaDivider />
          <ModeMetaChip
            icon="timer"
            label={isSingleMode ? loc.highAccuracyOnly : loc.highAccuracy}
          />
        </>
      )}
    </View>
  );
}

function ModeMetaChip({ icon, label }: { icon: IconName; label: string }) {
  const colors = useCardColors();
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
  attention,
}: {
  icon: IconName;
  label: string;
  color: string;
  onPress: () => void;
  attention?: boolean;
}) {
  const colors = useCardColors();
  const reducedMotion = useReducedMotion();
  const animate = !!attention && !reducedMotion;
  const float = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (!animate) return;
    float.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    glow.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(float);
      cancelAnimation(glow);
      float.value = 0;
      glow.value = 0;
    };
  }, [animate, float, glow]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -ATTENTION_FLOAT * float.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  const renderLabel = (style?: TextStyle) => (
    <Text variant="body2" weight="semibold" color={color} style={style}>
      {label}
    </Text>
  );

  return (
    <Animated.View style={attention ? floatStyle : undefined}>
      <PressableCluster
        onPress={onPress}
        style={styles.actionCluster}
        rippleColor={colors.ripple}
      >
        <Icon name={icon} size={18} color={color} />
        {attention ? (
          <View>
            {renderLabel(styles.attentionGlow)}
            <Animated.View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[StyleSheet.absoluteFill, glowStyle]}
            >
              {renderLabel({
                ...styles.attentionGlowPeak,
                textShadowColor: color,
              })}
            </Animated.View>
          </View>
        ) : (
          renderLabel()
        )}
      </PressableCluster>
    </Animated.View>
  );
}

function LanguagesChip({
  languagesText,
  onPress,
}: {
  languagesText: string;
  onPress?: () => void;
}) {
  const colors = useCardColors();

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
  const colors = useCardColors();
  return (
    <View
      style={[
        styles.metaDivider,
        { backgroundColor: colors.surfaceBorderPrimary },
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
  attentionGlow: {
    textShadowColor: "rgba(255, 255, 255, 0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  // A wide radius blurs into a haze over the whole cluster; keep it tight so
  // the glow hugs the glyphs.
  attentionGlowPeak: {
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
});
