import { StyleSheet, View } from "react-native";

import { AquaColors, useTheme } from "@/theme";

export interface DownloadProgressBarProps {
  /** Completion in 0…1. Values outside the range are clamped. */
  ratio: number;
  /** Pins colors on screens that ignore the app theme. */
  colors?: AquaColors;
  testID?: string;
}

/**
 * Determinate track+fill bar for a download in flight.
 *
 * Deliberately dumb: no percentage text, no cancel affordance. Callers own
 * the surrounding layout because a card and a list row need different ones.
 */
export const DownloadProgressBar = ({
  ratio,
  colors: colorsOverride,
  testID,
}: DownloadProgressBarProps) => {
  const { theme } = useTheme();
  const colors = colorsOverride ?? theme.colors;
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
      style={[styles.track, { backgroundColor: colors.accentBrandTransparent }]}
    >
      <View
        style={[
          styles.fill,
          {
            backgroundColor: colors.accentBrand,
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
