import { StyleSheet, View } from "react-native";
import Animated, {
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { useLocalization } from "@/hooks";
import { spacing } from "@/theme";

import { Text } from "../../../ui/text/Text";

import { TouchIndicator } from "./TouchIndicator";
import {
  type DemoProps,
  easeInOutCubic,
  LIST_MAX_WIDTH,
  mix,
  pressAmount,
  segment,
} from "./walkthrough";

// Mimics the stock (AOSP / Material 3) "Manage keyboards" screen, which
// INPUT_METHOD_SETTINGS opens on most devices, so these are system colors.
const PALETTES = {
  dark: {
    list: "#1E1F20",
    dialog: "#282A2C",
    label: "#FFFFFF",
    primary: "#A8C7FA",
    primaryClear: "rgba(168, 199, 250, 0)",
    primaryPressed: "rgba(168, 199, 250, 0.12)",
    onPrimary: "#062E6F",
    outline: "#8E918F",
    trackOff: "#333537",
    skeletonStrong: "rgba(227, 227, 227, 0.3)",
    skeleton: "rgba(227, 227, 227, 0.14)",
    shadow: "0px 8px 24px rgba(0, 0, 0, 0.5)",
    touch: "#FFFFFF",
  },
  light: {
    list: "#FFFFFF",
    dialog: "#E9EEF6",
    label: "#1F1F1F",
    primary: "#0B57D0",
    primaryClear: "rgba(11, 87, 208, 0)",
    primaryPressed: "rgba(11, 87, 208, 0.12)",
    onPrimary: "#FFFFFF",
    outline: "#747775",
    trackOff: "#E3E3E3",
    skeletonStrong: "rgba(31, 31, 31, 0.3)",
    skeleton: "rgba(31, 31, 31, 0.14)",
    shadow: "0px 8px 24px rgba(0, 0, 0, 0.16)",
    // Black reads much heavier than white over the same opacities.
    touch: "rgba(0, 0, 0, 0.4)",
  },
};
type Palette = (typeof PALETTES)["dark"];

const ROW_HEIGHT = 64;
const DIALOG_WIDTH = 296;
const DIALOG_ROOM = 200;
const THUMB_BOX = 28;

// Timeline (ms). Each TAP_* is the moment the finger presses down.
const TAP_TOGGLE = 1150;
const DIALOG_IN = TAP_TOGGLE + 320;
const TAP_OK = DIALOG_IN + 1100;
const DIALOG_OUT = TAP_OK + 240;
const SWITCH_ON_AT = DIALOG_OUT + 120;
export const ANDROID_DEMO_DONE = SWITCH_ON_AT + 450;

const dialogShown = (t: number) => {
  "worklet";
  return (
    segment(t, DIALOG_IN, 320) *
    (1 - segment(t, DIALOG_OUT, 180, easeInOutCubic))
  );
};

/**
 * Tap the Echos switch, confirm the system "may collect all the text you type"
 * dialog, switch turns on. The dialog copy is abstracted to skeleton lines
 * since it varies by OEM and Android version.
 */
export function AndroidSettingsDemo({ t, tooltip, dark, testID }: DemoProps) {
  const { loc } = useLocalization();
  const c = dark ? PALETTES.dark : PALETTES.light;
  const childTestID = (suffix: string) =>
    testID ? `${testID}-${suffix}` : undefined;

  const dialogStyle = useAnimatedStyle(() => {
    const enter = segment(t.value, DIALOG_IN, 320);
    const exit = segment(t.value, DIALOG_OUT, 180, easeInOutCubic);
    return {
      opacity: dialogShown(t.value),
      transform: [
        {
          scale: t.value < DIALOG_OUT ? mix(enter, 0.9, 1) : mix(exit, 1, 0.96),
        },
      ],
    };
  });
  const dimStyle = useAnimatedStyle(() => ({
    opacity: 1 - 0.6 * dialogShown(t.value),
  }));
  const okPressedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      pressAmount(t.value, TAP_OK),
      [0, 1],
      [c.primaryClear, c.primaryPressed],
    ),
  }));

  return (
    <View style={styles.stage}>
      <Animated.View style={[styles.group, dimStyle]}>
        {tooltip}
        <View
          style={[styles.card, { backgroundColor: c.list }]}
          testID={childTestID("list")}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={styles.row} testID={childTestID("echos")}>
            <Text
              variant="body1"
              weight="regular"
              color={c.label}
              style={styles.rowLabel}
              numberOfLines={1}
            >
              {loc.onboardingEnableKeyboardRowEchos}
            </Text>
            <MaterialSwitch t={t} c={c} />
          </View>
        </View>
      </Animated.View>

      <View
        pointerEvents="none"
        style={styles.dialogLayer}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Animated.View
          style={[
            styles.dialog,
            { backgroundColor: c.dialog, boxShadow: c.shadow },
            dialogStyle,
          ]}
        >
          <View
            style={[
              styles.bar,
              styles.title,
              { backgroundColor: c.skeletonStrong },
            ]}
          />
          <View style={styles.body}>
            <View style={[styles.bar, { backgroundColor: c.skeleton }]} />
            <View
              style={[
                styles.bar,
                { width: "94%", backgroundColor: c.skeleton },
              ]}
            />
            <View
              style={[
                styles.bar,
                { width: "58%", backgroundColor: c.skeleton },
              ]}
            />
          </View>
          <View style={styles.actions}>
            <View style={styles.action}>
              <Text variant="body2" weight="medium" color={c.primary}>
                {loc.cancel}
              </Text>
            </View>
            <Animated.View style={[styles.action, okPressedStyle]}>
              <Text variant="body2" weight="medium" color={c.primary}>
                {loc.onboardingEnableKeyboardDialogOk}
              </Text>
              <TouchIndicator
                t={t}
                at={TAP_OK}
                color={c.touch}
                style={styles.okTouch}
              />
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

// Material 3 switch: the thumb grows from 16 to 24dp when on, 28dp while held.
function MaterialSwitch({ t, c }: { t: SharedValue<number>; c: Palette }) {
  const trackStyle = useAnimatedStyle(() => {
    const on = segment(t.value, SWITCH_ON_AT, 300, easeInOutCubic);
    return {
      backgroundColor: interpolateColor(on, [0, 1], [c.trackOff, c.primary]),
      borderColor: interpolateColor(on, [0, 1], [c.outline, c.primary]),
    };
  });
  const thumbStyle = useAnimatedStyle(() => {
    const on = segment(t.value, SWITCH_ON_AT, 300, easeInOutCubic);
    const resting = mix(on, 16, 24);
    const diameter = mix(pressAmount(t.value, TAP_TOGGLE), resting, THUMB_BOX);
    return {
      backgroundColor: interpolateColor(on, [0, 1], [c.outline, c.onPrimary]),
      transform: [
        { translateX: mix(on, 16, 36) - THUMB_BOX / 2 },
        { scale: diameter / THUMB_BOX },
      ],
    };
  });

  return (
    <View style={styles.switch}>
      <Animated.View style={[styles.track, trackStyle]} />
      <Animated.View style={[styles.thumb, thumbStyle]} />
      <TouchIndicator
        t={t}
        at={TAP_TOGGLE}
        color={c.touch}
        style={styles.switchTouch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: "100%",
    maxWidth: LIST_MAX_WIDTH,
    minHeight: DIALOG_ROOM,
    justifyContent: "center",
  },
  group: {
    alignItems: "center",
    gap: spacing.sm,
  },
  card: {
    alignSelf: "stretch",
    borderRadius: 26,
    overflow: "hidden",
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rowLabel: {
    flex: 1,
  },
  switch: {
    width: 52,
    height: 32,
  },
  track: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 2,
  },
  thumb: {
    position: "absolute",
    left: 0,
    top: (32 - THUMB_BOX) / 2,
    width: THUMB_BOX,
    height: THUMB_BOX,
    borderRadius: THUMB_BOX / 2,
  },
  // Centered on the off-state thumb.
  switchTouch: {
    left: -6,
    top: -6,
  },
  dialogLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  dialog: {
    width: DIALOG_WIDTH,
    maxWidth: "100%",
    padding: spacing.lg,
    borderRadius: 28,
  },
  title: {
    width: "45%",
    height: 12,
    borderRadius: 6,
  },
  body: {
    marginTop: spacing.md,
    gap: 10,
  },
  bar: {
    height: 8,
    borderRadius: 4,
  },
  actions: {
    marginTop: spacing.lg,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  action: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    justifyContent: "center",
  },
  okTouch: {
    left: "50%",
    marginLeft: -22,
    top: -2,
  },
});
