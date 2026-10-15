import { StyleSheet, View } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import Animated from "react-native-reanimated";
import {
  useSafeAreaFrame,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useLocalization } from "@/hooks";
import { darkColors, spacing } from "@/theme";

import { Button } from "../../../ui/button/Button";
import { Text } from "../../../ui/text/Text";
import { OnboardingHeader } from "../header/OnboardingHeader";

import {
  SettingsWalkthrough,
  useSettingsWalkthrough,
} from "./SettingsWalkthrough";

const ENABLE_KEYBOARD_STEP = 2;

export interface EnableKeyboardScreenProps {
  onBack: () => void;
  onSkip: () => void;
  onGoToSettings: () => void;
  testID?: string;
}

/**
 * Presentational only — opening Settings and navigation live at the route.
 * Go to Settings unlocks when the walkthrough ends.
 */
export const EnableKeyboardScreen = ({
  onBack,
  onSkip,
  onGoToSettings,
  testID,
}: EnableKeyboardScreenProps) => {
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const landscape = frame.width > frame.height;
  const { loc } = useLocalization();
  const { t, done, ctaStyle } = useSettingsWalkthrough();

  return (
    <View testID={testID} style={styles.root}>
      <SystemBars style="light" />
      <OnboardingHeader
        step={ENABLE_KEYBOARD_STEP}
        onBack={onBack}
        onSkip={onSkip}
        testID={testID}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: landscape ? spacing.sm : spacing.xl,
            paddingBottom: insets.bottom + spacing.md,
            paddingLeft: insets.left + spacing.md,
            paddingRight: insets.right + spacing.md,
          },
        ]}
      >
        <Text
          variant="h4"
          weight="medium"
          align="center"
          color={darkColors.textPrimary}
          style={styles.title}
        >
          {loc.onboardingEnableKeyboardTitle}
        </Text>

        <SettingsWalkthrough t={t} dark testID={testID} />

        <Animated.View style={[styles.cta, ctaStyle]}>
          <Button.primary
            testID={testID ? `${testID}-go-to-settings` : undefined}
            text={loc.onboardingGoToSettings}
            enabled={done}
            onPress={onGoToSettings}
          />
        </Animated.View>
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
    alignItems: "stretch",
  },
  title: {
    flexShrink: 0,
  },
  cta: {
    flexShrink: 0,
    alignSelf: "stretch",
  },
});
