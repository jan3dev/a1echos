import { Image, StyleSheet, TextInput, View } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useKeyboardHeight, useLocalization } from "@/hooks";
import { darkColors, spacing } from "@/theme";

import { AmbientGlow } from "../../../shared/ambient-glow/AmbientGlow";
import { Text } from "../../../ui/text/Text";
import { OnboardingHeader } from "../header/OnboardingHeader";

const SWITCH_KEYBOARD_IMAGE = require("@/assets/images/switch-keyboard.png");
const TUTORIAL_STEP = 1;

export interface SwitchKeyboardScreenProps {
  onBack: () => void;
  onSkip: () => void;
  testID?: string;
}

/** Focuses a hidden input so the system keyboard, and its globe key, is up. */
export const SwitchKeyboardScreen = ({
  onBack,
  onSkip,
  testID,
}: SwitchKeyboardScreenProps) => {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { loc } = useLocalization();

  return (
    <View testID={testID} style={styles.root}>
      <SystemBars style="light" />
      <AmbientGlow />
      <OnboardingHeader
        step={TUTORIAL_STEP}
        onBack={onBack}
        onSkip={onSkip}
        testID={testID}
      />

      <View
        style={[
          styles.content,
          {
            paddingBottom: Math.max(keyboardHeight, insets.bottom) + spacing.md,
            paddingLeft: insets.left + spacing.md,
            paddingRight: insets.right + spacing.md,
          },
        ]}
      >
        <View style={styles.copy}>
          <Text
            variant="h4"
            weight="medium"
            align="center"
            color={darkColors.textPrimary}
          >
            {loc.onboardingSwitchKeyboardTitle}
          </Text>
          <Text
            variant="body1"
            weight="medium"
            align="center"
            color={darkColors.textSecondary}
          >
            {loc.onboardingSwitchKeyboardSubtitle}
          </Text>
        </View>

        <View style={styles.illustration}>
          <Image
            source={SWITCH_KEYBOARD_IMAGE}
            style={styles.illustrationImage}
            accessibilityIgnoresInvertColors
          />
        </View>
      </View>

      <TextInput
        allowFontScaling={false}
        testID={testID ? `${testID}-input` : undefined}
        autoFocus
        caretHidden
        contextMenuHidden
        autoCorrect={false}
        keyboardAppearance="dark"
        style={styles.hiddenInput}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
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
    alignItems: "center",
    gap: spacing.xl,
    paddingTop: spacing.xl,
  },
  copy: {
    alignSelf: "stretch",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  // Shows only the bottom of the full-screen capture, as cropped in the design.
  illustration: {
    height: 212,
    aspectRatio: 235 / 212,
    flexShrink: 1,
    minHeight: 0,
    overflow: "hidden",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  illustrationImage: {
    position: "absolute",
    left: 0,
    top: "-140.68%",
    width: "100.08%",
    height: "240.68%",
  },
  // Must stay mounted and laid out, or focus (and the keyboard) never happens.
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
});
