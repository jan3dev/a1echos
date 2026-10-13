import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  useSafeAreaFrame,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { useLocalization } from "@/hooks";
import { AquaPrimitiveColors, darkColors, spacing } from "@/theme";

import { Button } from "../../../ui/button/Button";
import { Icon } from "../../../ui/icon/Icon";
import { Text } from "../../../ui/text/Text";
import { OnboardingHeader } from "../header/OnboardingHeader";

import { ANDROID_DEMO_DONE, AndroidSettingsDemo } from "./AndroidSettingsDemo";
import { IOS_DEMO_DONE, IosSettingsDemo } from "./IosSettingsDemo";
import { mix, segment } from "./walkthrough";

const ENABLE_KEYBOARD_STEP = 2;
const POINTER_WIDTH = 14;
const POINTER_HEIGHT = 8;
const CTA_FADE_MS = 400;

export interface EnableKeyboardScreenProps {
  onBack: () => void;
  onSkip: () => void;
  onGoToSettings: () => void;
  testID?: string;
}

/**
 * Presentational only — opening Settings and navigation live at the route.
 * Plays a walkthrough of the system Settings steps once per mount (so again
 * after Back and forward); Go to Settings unlocks when it ends.
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
  const childTestID = (suffix: string) =>
    testID ? `${testID}-${suffix}` : undefined;
  const isIos = Platform.OS === "ios";
  const Demo = isIos ? IosSettingsDemo : AndroidSettingsDemo;
  const doneAt = isIos ? IOS_DEMO_DONE : ANDROID_DEMO_DONE;
  const end = doneAt + CTA_FADE_MS;

  const reduceMotion = useReducedMotion();
  const t = useSharedValue(reduceMotion ? end : 0);
  const [done, setDone] = useState(reduceMotion);
  const [available, setAvailable] = useState(0);
  const [natural, setNatural] = useState(0);
  const scale = available && natural ? Math.min(1, available / natural) : 1;

  useEffect(() => {
    if (reduceMotion) return;
    t.value = withTiming(end, { duration: end, easing: Easing.linear });
    const timer = setTimeout(() => setDone(true), doneAt);
    return () => {
      clearTimeout(timer);
      cancelAnimation(t);
    };
  }, [t, end, doneAt, reduceMotion]);

  // The Button dims itself to 0.5 while disabled; take over from there.
  const ctaStyle = useAnimatedStyle(() => ({
    opacity: done ? mix(segment(t.value, doneAt, CTA_FADE_MS), 0.5, 1) : 1,
  }));

  const tooltip = (
    <View style={styles.tooltip}>
      <View style={styles.bubble}>
        <Icon name="info_circle" size={18} color={darkColors.textPrimary} />
        <Text
          variant="body2"
          weight="medium"
          color={darkColors.textPrimary}
          style={styles.bubbleText}
        >
          {loc.onboardingEnableKeyboardTooltip}
        </Text>
      </View>
      <Svg
        width={POINTER_WIDTH}
        height={POINTER_HEIGHT}
        viewBox={`0 0 ${POINTER_WIDTH} ${POINTER_HEIGHT}`}
      >
        <Path
          d={`M0 0 L${POINTER_WIDTH / 2} ${POINTER_HEIGHT} L${POINTER_WIDTH} 0 Z`}
          fill={AquaPrimitiveColors.glassSurfaceSecondaryDark}
        />
      </Svg>
    </View>
  );

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

        <View
          style={styles.illustration}
          testID={childTestID("illustration")}
          onLayout={(e) => setAvailable(e.nativeEvent.layout.height)}
        >
          <View
            style={[styles.scaler, { transform: [{ scale }] }]}
            testID={childTestID("illustration-content")}
            onLayout={(e) => setNatural(e.nativeEvent.layout.height)}
          >
            <Demo t={t} tooltip={tooltip} testID={testID} />
          </View>
        </View>

        <Animated.View style={[styles.cta, ctaStyle]}>
          <Button.primary
            testID={childTestID("go-to-settings")}
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
  illustration: {
    flex: 1,
    minHeight: 0,
    justifyContent: "center",
    overflow: "hidden",
  },
  scaler: {
    alignItems: "center",
  },
  tooltip: {
    alignItems: "center",
    maxWidth: 290,
  },
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 300,
    backgroundColor: AquaPrimitiveColors.glassSurfaceSecondaryDark,
  },
  bubbleText: {
    flexShrink: 1,
  },
  cta: {
    flexShrink: 0,
    alignSelf: "stretch",
  },
});
