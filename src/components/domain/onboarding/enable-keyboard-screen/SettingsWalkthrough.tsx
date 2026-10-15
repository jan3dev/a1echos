import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { useLocalization } from "@/hooks";
import { darkColors, lightColors, spacing } from "@/theme";

import { Icon } from "../../../ui/icon/Icon";
import { Text } from "../../../ui/text/Text";

import { ANDROID_DEMO_DONE, AndroidSettingsDemo } from "./AndroidSettingsDemo";
import { IOS_DEMO_DONE, IosSettingsDemo } from "./IosSettingsDemo";
import { mix, segment } from "./walkthrough";

const POINTER_WIDTH = 14;
const POINTER_HEIGHT = 8;
const CTA_FADE_MS = 400;

const demoDoneAt = () =>
  Platform.OS === "ios" ? IOS_DEMO_DONE : ANDROID_DEMO_DONE;

/**
 * Plays the walkthrough once per mount (so again after Back and forward).
 * `done` unlocks the CTA; `ctaStyle` fades it in from the disabled Button's 0.5.
 */
export const useSettingsWalkthrough = () => {
  const doneAt = demoDoneAt();
  const end = doneAt + CTA_FADE_MS;
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(reduceMotion ? end : 0);
  const [done, setDone] = useState(reduceMotion);

  useEffect(() => {
    if (reduceMotion) return;
    t.value = withTiming(end, { duration: end, easing: Easing.linear });
    const timer = setTimeout(() => setDone(true), doneAt);
    return () => {
      clearTimeout(timer);
      cancelAnimation(t);
    };
  }, [t, end, doneAt, reduceMotion]);

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: done ? mix(segment(t.value, doneAt, CTA_FADE_MS), 0.5, 1) : 1,
  }));

  return { t, done, ctaStyle };
};

interface SettingsWalkthroughProps {
  t: SharedValue<number>;
  dark: boolean;
  testID?: string;
}

/** The system Settings steps, scaled down to fit the space it's given. */
export const SettingsWalkthrough = ({
  t,
  dark,
  testID,
}: SettingsWalkthroughProps) => {
  const { loc } = useLocalization();
  const colors = dark ? darkColors : lightColors;
  const childTestID = (suffix: string) =>
    testID ? `${testID}-${suffix}` : undefined;
  const Demo = Platform.OS === "ios" ? IosSettingsDemo : AndroidSettingsDemo;
  const [available, setAvailable] = useState(0);
  const [natural, setNatural] = useState(0);
  const scale = available && natural ? Math.min(1, available / natural) : 1;

  const tooltip = (
    <View style={styles.tooltip}>
      <View
        style={[
          styles.bubble,
          { backgroundColor: colors.glassSurfaceSecondary },
        ]}
      >
        <Icon name="info_circle" size={18} color={colors.textPrimary} />
        <Text
          variant="body2"
          weight="medium"
          color={colors.textPrimary}
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
          fill={colors.glassSurfaceSecondary}
        />
      </Svg>
    </View>
  );

  return (
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
        <Demo t={t} tooltip={tooltip} dark={dark} testID={testID} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
  },
  bubbleText: {
    flexShrink: 1,
  },
});
