import { StyleSheet, type ViewStyle } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import TouchIndicatorSvg from "@/assets/images/touch_indicator.svg";

import { mix, PRESS_MS, segment } from "./walkthrough";

const TOUCH_SIZE = 44;
const LAND_MS = 260;
const LIFT_MS = 240;

interface TouchIndicatorProps {
  t: SharedValue<number>;
  /** Press moment in ms on the timeline. */
  at: number;
  color: string;
  style: ViewStyle;
}

/** The demo finger: lands, presses, lifts off. */
export function TouchIndicator({ t, at, color, style }: TouchIndicatorProps) {
  const animated = useAnimatedStyle(() => {
    const land = segment(t.value, at - LAND_MS, LAND_MS);
    const press = segment(t.value, at, 120);
    const lift = segment(t.value, at + PRESS_MS, LIFT_MS);
    const scale =
      t.value < at + PRESS_MS
        ? mix(land, 1.35, 1) - 0.14 * press
        : 0.86 + 0.4 * lift;
    return { opacity: land * (1 - lift), transform: [{ scale }] };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.indicator, style, animated]}
    >
      <TouchIndicatorSvg width={TOUCH_SIZE} height={TOUCH_SIZE} color={color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  indicator: {
    position: "absolute",
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
  },
});
