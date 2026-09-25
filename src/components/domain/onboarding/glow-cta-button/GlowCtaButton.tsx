import { useState } from "react";
import { StyleSheet } from "react-native";

import { AquaPrimitiveColors, darkColors, spacing } from "@/theme";
import { iosPressed } from "@/utils";

import { RipplePressable } from "../../../ui/ripple-pressable/RipplePressable";
import { Text } from "../../../ui/text/Text";

export interface GlowCtaButtonProps {
  text: string;
  onPress: () => void;
  testID?: string;
}

/**
 * Dark-fixed onboarding CTA: the pill fill is the background color so it reads
 * as floating, glowing white text on the dark backdrop (per the design), with
 * no elevation shadow.
 */
export const GlowCtaButton = ({
  text,
  onPress,
  testID,
}: GlowCtaButtonProps) => {
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
      style={[styles.button, { opacity: iosPressed(pressed, 0.9) }]}
    >
      <Text
        variant="body1"
        weight="semibold"
        align="center"
        color={AquaPrimitiveColors.white}
        style={styles.label}
      >
        {text}
      </Text>
    </RipplePressable>
  );
};

const styles = StyleSheet.create({
  button: {
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
  label: {
    textShadowColor: "rgba(255, 255, 255, 0.8)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 80,
  },
});
