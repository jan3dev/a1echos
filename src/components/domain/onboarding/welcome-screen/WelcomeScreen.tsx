import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocalization } from "@/hooks";
import { AquaPrimitiveColors, darkColors, spacing } from "@/theme";
import { iosPressed } from "@/utils";

import { AmbientGlow } from "../../../shared/ambient-glow/AmbientGlow";
import { Icon } from "../../../ui/icon/Icon";
import { RipplePressable } from "../../../ui/ripple-pressable/RipplePressable";
import { Text } from "../../../ui/text/Text";

export interface WelcomeScreenProps {
  onGetStarted: () => void;
  testID?: string;
}

/**
 * Welcome CTA. Dark-fixed to match the surrounding screen: the pill fill is the
 * surface/background color so the button reads as floating, glowing white text
 * on the dark backdrop (per the design), with no elevation shadow. Uses
 * RipplePressable directly rather than the themed `Button` — `Button`'s colors
 * follow the active theme and would mismatch this dark-fixed screen.
 */
const GetStartedButton = ({
  text,
  onPress,
  testID,
}: {
  text: string;
  onPress: () => void;
  testID?: string;
}) => {
  const [pressed, setPressed] = useState(false);

  return (
    <RipplePressable
      testID={testID}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={text}
      rippleColor={darkColors.rippleOnPrimary}
      style={[styles.ctaButton, { opacity: iosPressed(pressed, 0.9) }]}
    >
      <Text
        variant="body1"
        weight="semibold"
        align="center"
        color={AquaPrimitiveColors.white}
        style={styles.ctaLabel}
      >
        {text}
      </Text>
    </RipplePressable>
  );
};

/**
 * First-launch welcome screen. Dark-fixed (uses `darkColors` regardless of the
 * active theme) so the ambient glow reads correctly, matching the design.
 * Presentational only — persistence and navigation live at the route.
 */
export const WelcomeScreen = ({ onGetStarted, testID }: WelcomeScreenProps) => {
  const insets = useSafeAreaInsets();
  const { loc } = useLocalization();

  return (
    <View
      testID={testID}
      style={[styles.root, { backgroundColor: darkColors.surfaceBackground }]}
    >
      <SystemBars style="light" />
      <AmbientGlow />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + spacing.lg,
            paddingBottom: insets.bottom + spacing.md,
          },
        ]}
      >
        <View style={styles.intro}>
          <Icon name="echos_mark" size={64} color={darkColors.textPrimary} />
          <View style={styles.copy}>
            <Text
              variant="h4"
              weight="medium"
              align="center"
              color={darkColors.textPrimary}
            >
              {loc.welcomeTitle}
            </Text>
            <Text
              variant="body1"
              weight="medium"
              align="center"
              color={darkColors.textSecondary}
            >
              {loc.welcomeSubtitle}
            </Text>
          </View>
        </View>

        <View style={styles.cta}>
          <GetStartedButton
            text={loc.welcomeGetStarted}
            onPress={onGetStarted}
            testID={testID ? `${testID}-cta` : undefined}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  intro: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  copy: {
    alignItems: "center",
    gap: spacing.md,
  },
  cta: {
    minHeight: 56,
    justifyContent: "center",
  },
  ctaButton: {
    minHeight: 56,
    borderRadius: 80,
    backgroundColor: darkColors.surfaceBackground,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    overflow: "hidden",
  },
  ctaLabel: {
    textShadowColor: "rgba(255, 255, 255, 0.8)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 80,
  },
});
