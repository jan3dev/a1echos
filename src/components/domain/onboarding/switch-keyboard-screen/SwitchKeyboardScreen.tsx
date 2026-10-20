import { Image, Platform, StyleSheet, TextInput, View } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import {
  useSafeAreaFrame,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useKeyboardHeight, useLocalization } from "@/hooks";
import { darkColors, spacing } from "@/theme";

import { AmbientGlow } from "../../../shared/ambient-glow/AmbientGlow";
import { Button } from "../../../ui/button/Button";
import { Text } from "../../../ui/text/Text";
import { OnboardingHeader } from "../header/OnboardingHeader";

const SWITCH_KEYBOARD_IMAGE = require("@/assets/images/switch-keyboard.png");
const TUTORIAL_STEP = 1;

export interface SwitchKeyboardScreenProps {
  onBack: () => void;
  onSkip: () => void;
  /** Android: opens the system keyboard picker. */
  onChooseKeyboard: () => void;
  testID?: string;
}

/**
 * iOS focuses a hidden input so the keyboard, and its globe key, is up.
 * Android opens the system picker instead (Samsung's globe only changes
 * languages), so no keyboard covers the button.
 */
export const SwitchKeyboardScreen = ({
  onBack,
  onSkip,
  onChooseKeyboard,
  testID,
}: SwitchKeyboardScreenProps) => {
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const landscape = frame.width > frame.height;
  const keyboardHeight = useKeyboardHeight();
  const { loc } = useLocalization();
  const android = Platform.OS === "android";
  // Samsung hides the system's keyboard switch button by default.
  const samsung =
    Platform.OS === "android" &&
    Platform.constants.Manufacturer.toLowerCase() === "samsung";

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
            paddingTop: landscape ? spacing.sm : spacing.xl,
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
            {android
              ? loc.onboardingSwitchKeyboardTitleAndroid
              : loc.onboardingSwitchKeyboardTitle}
          </Text>
          <Text
            variant="body1"
            weight="medium"
            align="center"
            color={darkColors.textSecondary}
          >
            {android
              ? loc.onboardingSwitchKeyboardSubtitleAndroid
              : loc.onboardingSwitchKeyboardSubtitle}
          </Text>
        </View>

        {android ? (
          <View style={styles.actions}>
            {samsung && (
              <Text
                variant="body2"
                weight="regular"
                align="center"
                color={darkColors.textSecondary}
                testID={testID ? `${testID}-samsung-tip` : undefined}
              >
                {loc.onboardingSwitchKeyboardSamsungTip}
              </Text>
            )}
            <Button.primary
              testID={testID ? `${testID}-choose-keyboard` : undefined}
              text={loc.onboardingChooseKeyboard}
              onPress={onChooseKeyboard}
            />
          </View>
        ) : (
          <View style={styles.illustration}>
            <Image
              source={SWITCH_KEYBOARD_IMAGE}
              style={styles.illustrationImage}
              accessibilityIgnoresInvertColors
            />
          </View>
        )}
      </View>

      {!android && (
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
      )}
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
  },
  copy: {
    alignSelf: "stretch",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  actions: {
    alignSelf: "stretch",
    marginTop: "auto",
    gap: spacing.md,
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
