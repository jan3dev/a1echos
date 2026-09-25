import { Canvas, Group, Skia, Skottie } from "@shopify/react-native-skia";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import {
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SystemBars } from "react-native-edge-to-edge";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocalization } from "@/hooks";
import { darkColors, spacing } from "@/theme";

import { AmbientGlow } from "../../../shared/ambient-glow/AmbientGlow";
import { Text } from "../../../ui/text/Text";
import { GlowCtaButton } from "../glow-cta-button/GlowCtaButton";
import { OnboardingHeader } from "../header/OnboardingHeader";

const CHECK_ANIMATION = Skia.Skottie.Make(
  JSON.stringify(require("@/assets/animations/check-ring.json")),
);
const CHECK_SIZE = 197;
const CHECK_LAST_FRAME = CHECK_ANIMATION.duration() * CHECK_ANIMATION.fps() - 1;

export interface AllSetScreenProps {
  onBack: () => void;
  onGetStarted: () => void;
  testID?: string;
}

export const AllSetScreen = ({
  onBack,
  onGetStarted,
  testID,
}: AllSetScreenProps) => {
  const insets = useSafeAreaInsets();
  const { loc } = useLocalization();
  const reduceMotion = useReducedMotion();
  const frame = useSharedValue(0);
  const canvasSize = useSharedValue({ width: CHECK_SIZE, height: CHECK_SIZE });
  const scale = useDerivedValue(() => [
    { scale: canvasSize.value.width / CHECK_SIZE },
  ]);

  useEffect(() => {
    frame.value = reduceMotion
      ? CHECK_LAST_FRAME
      : withTiming(CHECK_LAST_FRAME, {
          duration: CHECK_ANIMATION.duration() * 1000,
          easing: Easing.linear,
        });
  }, [frame, reduceMotion]);

  return (
    <View testID={testID} style={styles.root}>
      <SystemBars style="light" />
      <AmbientGlow />
      <OnboardingHeader onBack={onBack} testID={testID} />

      <View
        style={[
          styles.content,
          {
            paddingBottom: insets.bottom + spacing.md,
            paddingLeft: insets.left + spacing.md,
            paddingRight: insets.right + spacing.md,
          },
        ]}
      >
        <View style={styles.center}>
          <Canvas
            testID={testID ? `${testID}-check` : undefined}
            style={styles.check}
            onSize={canvasSize}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Group transform={scale}>
              <Skottie animation={CHECK_ANIMATION} frame={frame} />
            </Group>
          </Canvas>
          <View style={styles.copy}>
            <Text
              variant="h3"
              weight="medium"
              align="center"
              color={darkColors.textPrimary}
            >
              {loc.onboardingAllSetTitle}
            </Text>
            <Text
              variant="body1"
              weight="medium"
              align="center"
              color={darkColors.textSecondary}
            >
              {loc.onboardingAllSetSubtitle}
            </Text>
          </View>
        </View>

        <GlowCtaButton
          text={loc.welcomeGetStarted}
          onPress={onGetStarted}
          testID={testID ? `${testID}-cta` : undefined}
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
  content: {
    flex: 1,
    minHeight: 0,
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  center: {
    flex: 1,
    minHeight: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  check: {
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    aspectRatio: 1,
    flexShrink: 1,
  },
  copy: {
    alignSelf: "stretch",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
});
