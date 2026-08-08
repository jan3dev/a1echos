import { StyleSheet, View } from "react-native";

import { useTheme } from "@/theme";

export interface DownloadProgressBarProps {
  /** Completion in 0…1. Values outside the range are clamped. */
  ratio: number;
  testID?: string;
}

/**
 * Determinate track+fill bar for a download in flight. Shared by the model
 * card and the Advanced-settings context-aware autocorrect row so the two
 * read as the same control rather than two similar-looking bars.
 *
 * Deliberately dumb: no percentage text, no cancel affordance. Callers own
 * the surrounding layout because a card and a list row need different ones.
 */
export const DownloadProgressBar = ({
  ratio,
  testID,
}: DownloadProgressBarProps) => {
  const { theme } = useTheme();
  // A NaN width silently collapses the fill to zero, so a bad ratio would
  // look like "stuck at 0%" rather than a bug worth reporting.
  const safeRatio = Number.isFinite(ratio)
    ? Math.min(1, Math.max(0, ratio))
    : 0;

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(safeRatio * 100),
      }}
      style={[
        styles.track,
        { backgroundColor: theme.colors.accentBrandTransparent },
      ]}
    >
      <View
        style={[
          styles.fill,
          {
            backgroundColor: theme.colors.accentBrand,
            width: `${safeRatio * 100}%`,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  fill: {
    height: 4,
    borderRadius: 8,
  },
});
