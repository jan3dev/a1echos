import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import {
  useSafeAreaFrame,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { AppConstants } from "@/constants";
import { useLocalization } from "@/hooks";
import { darkColors, spacing } from "@/theme";
import { iosPressed } from "@/utils";

import { Icon } from "../../../ui/icon/Icon";
import { RipplePressable } from "../../../ui/ripple-pressable/RipplePressable";
import { Text } from "../../../ui/text/Text";
import { OnboardingStepIndicator } from "../step-indicator/OnboardingStepIndicator";

export interface OnboardingHeaderProps {
  step: number;
  onBack: () => void;
  onSkip: () => void;
  testID?: string;
}

interface HeaderActionProps {
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
  children: ReactNode;
}

function HeaderAction({
  onPress,
  accessibilityLabel,
  testID,
  children,
}: HeaderActionProps) {
  return (
    <RipplePressable
      testID={testID}
      onPress={onPress}
      hitSlop={10}
      rippleColor={darkColors.ripple}
      borderless
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({ opacity: iosPressed(pressed) })}
    >
      {children}
    </RipplePressable>
  );
}

/** Dark-fixed inline header shared by the onboarding steps after Welcome. */
export const OnboardingHeader = ({
  step,
  onBack,
  onSkip,
  testID,
}: OnboardingHeaderProps) => {
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const landscape = frame.width > frame.height;
  const verticalPad = landscape ? spacing.xs : spacing.md;
  const { loc } = useLocalization();
  const childTestID = (suffix: string) =>
    testID ? `${testID}-${suffix}` : undefined;

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + verticalPad,
          paddingLeft: insets.left + spacing.md,
          paddingRight: insets.right + spacing.md,
          paddingBottom: verticalPad,
        },
      ]}
    >
      <View style={styles.headerSide}>
        <HeaderAction
          testID={childTestID("back")}
          onPress={onBack}
          accessibilityLabel={loc.back}
        >
          <Icon name="chevron_left" size={24} color={darkColors.textPrimary} />
        </HeaderAction>
      </View>
      <OnboardingStepIndicator
        step={step}
        totalSteps={AppConstants.ONBOARDING_STEP_COUNT}
        testID={childTestID("steps")}
      />
      <View style={[styles.headerSide, styles.headerTrailing]}>
        <HeaderAction
          testID={childTestID("skip")}
          onPress={onSkip}
          accessibilityLabel={loc.onboardingSkip}
        >
          <Text
            variant="body2"
            weight="medium"
            color={darkColors.textSecondary}
          >
            {loc.onboardingSkip}
          </Text>
        </HeaderAction>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
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
});
