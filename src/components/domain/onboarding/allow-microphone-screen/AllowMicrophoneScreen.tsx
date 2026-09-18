import { StyleSheet, View } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppConstants } from "@/constants";
import { useLocalization } from "@/hooks";
import { darkColors, spacing } from "@/theme";
import { iosPressed } from "@/utils";

import { RecordingButton } from "../../../shared/recording-controls/RecordingButton";
import { Button } from "../../../ui/button/Button";
import { Icon } from "../../../ui/icon/Icon";
import { RipplePressable } from "../../../ui/ripple-pressable/RipplePressable";
import { Text } from "../../../ui/text/Text";
import { OnboardingStepIndicator } from "../step-indicator/OnboardingStepIndicator";

import { GradientBars } from "./GradientBars";

const ALLOW_MICROPHONE_STEP = 2;
const RECORD_BUTTON_SIZE = 80;
// Overlaps the bars' lower third to match the design.
const RECORD_BUTTON_BOTTOM_OFFSET = -8;

export interface AllowMicrophoneScreenProps {
  onBack: () => void;
  onSkip: () => void;
  onAllow: () => void;
  testID?: string;
}

/**
 * Dark-fixed like WelcomeScreen, so the header is inline rather than TopAppBar.
 * Presentational only — permission, toasts and navigation live at the route.
 */
export const AllowMicrophoneScreen = ({
  onBack,
  onSkip,
  onAllow,
  testID,
}: AllowMicrophoneScreenProps) => {
  const insets = useSafeAreaInsets();
  const { loc } = useLocalization();
  const childTestID = (suffix: string) =>
    testID ? `${testID}-${suffix}` : undefined;

  return (
    <View testID={testID} style={styles.root}>
      <SystemBars style="light" />

      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerSide}>
          <RipplePressable
            testID={childTestID("back")}
            onPress={onBack}
            hitSlop={10}
            rippleColor={darkColors.ripple}
            borderless
            accessibilityRole="button"
            accessibilityLabel={loc.back}
            style={({ pressed }) => ({ opacity: iosPressed(pressed) })}
          >
            <Icon
              name="chevron_left"
              size={24}
              color={darkColors.textPrimary}
            />
          </RipplePressable>
        </View>
        <OnboardingStepIndicator
          step={ALLOW_MICROPHONE_STEP}
          totalSteps={AppConstants.ONBOARDING_STEP_COUNT}
          testID={childTestID("steps")}
        />
        <View style={[styles.headerSide, styles.headerTrailing]}>
          <RipplePressable
            testID={childTestID("skip")}
            onPress={onSkip}
            hitSlop={10}
            rippleColor={darkColors.ripple}
            borderless
            accessibilityRole="button"
            accessibilityLabel={loc.onboardingSkip}
            style={({ pressed }) => ({ opacity: iosPressed(pressed) })}
          >
            <Text
              variant="body2"
              weight="medium"
              color={darkColors.textSecondary}
            >
              {loc.onboardingSkip}
            </Text>
          </RipplePressable>
        </View>
      </View>

      <View
        style={[styles.content, { paddingBottom: insets.bottom + spacing.md }]}
      >
        <Text
          variant="h4"
          weight="medium"
          align="center"
          color={darkColors.textPrimary}
        >
          {loc.onboardingAllowMicrophoneTitle}
        </Text>

        <View style={styles.illustration}>
          <GradientBars testID={childTestID("bars")} />
          <View style={styles.recordButton}>
            <RecordingButton
              colors={darkColors}
              size={RECORD_BUTTON_SIZE}
              onRecordingStart={onAllow}
            />
          </View>
        </View>

        <Button.primary
          testID={childTestID("allow")}
          text={loc.onboardingAllow}
          onPress={onAllow}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: darkColors.surfaceBackground,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  // Flex sides keep the indicator centered. TopAppBar's 64pt sides overflow
  // once the indicator carries all onboarding steps.
  headerSide: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  headerTrailing: {
    justifyContent: "flex-end",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
  },
  illustration: {
    width: "100%",
    alignItems: "center",
  },
  recordButton: {
    position: "absolute",
    bottom: RECORD_BUTTON_BOTTOM_OFFSET,
  },
});
