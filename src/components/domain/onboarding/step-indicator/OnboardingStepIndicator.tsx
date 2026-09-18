import { StyleSheet, View } from "react-native";

import { darkColors, spacing } from "@/theme";

export interface OnboardingStepIndicatorProps {
  /** 1-based index of the active step. */
  step: number;
  totalSteps: number;
  testID?: string;
}

const DOT = 6;
const ACTIVE_WIDTH = 24;

export const OnboardingStepIndicator = ({
  step,
  totalSteps,
  testID,
}: OnboardingStepIndicatorProps) => (
  <View
    testID={testID}
    style={styles.row}
    accessibilityRole="progressbar"
    accessibilityValue={{ min: 1, max: totalSteps, now: step }}
  >
    {Array.from({ length: totalSteps }, (_, i) => (
      <View
        key={i}
        testID={testID ? `${testID}-dot-${i + 1}` : undefined}
        style={[styles.dot, i + 1 === step && styles.activeDot]}
      />
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: spacing.sm,
    backgroundColor: darkColors.surfaceTertiary,
  },
  activeDot: {
    width: ACTIVE_WIDTH,
    backgroundColor: darkColors.textPrimary,
  },
});
