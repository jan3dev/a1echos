import { useEffect, useId } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { AquaPrimitiveColors } from "@/theme";

export interface AmbientGlowProps {
  /** Color of the left glow source. Defaults to a lighter neon blue. */
  accentLeft?: string;
  /** Color of the right glow source. Defaults to the brand neon blue. */
  accentRight?: string;
  /** Peak opacity of each glow source at its center, 0–1. */
  intensity?: number;
  /** Softly drift the colors. Disabled automatically under reduce-motion. */
  animated?: boolean;
  testID?: string;
}

// Two bluish tones from the theme palette, matching the welcome-screen design.
const DEFAULT_LEFT = AquaPrimitiveColors.neonBlue400;
const DEFAULT_RIGHT = AquaPrimitiveColors.neonBlue500;

/**
 * One full-bleed radial gradient with a three-stop falloff (solid center →
 * faint mid → transparent edge), centered below the bottom edge by its caller.
 */
const RadialGlow = ({
  gradientId,
  cx,
  cy,
  r,
  color,
  intensity,
}: {
  gradientId: string;
  cx: string;
  cy: string;
  r: string;
  color: string;
  intensity: number;
}) => (
  <Svg width="100%" height="100%">
    <Defs>
      <RadialGradient id={gradientId} cx={cx} cy={cy} r={r}>
        <Stop offset="0" stopColor={color} stopOpacity={intensity} />
        <Stop offset="0.55" stopColor={color} stopOpacity={intensity * 0.35} />
        <Stop offset="1" stopColor={color} stopOpacity={0} />
      </RadialGradient>
    </Defs>
    <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
  </Svg>
);

/**
 * Soft ambient light rising from the bottom of its container. Two large radial
 * gradients (two bluish tones) are centered just below the bottom edge so only
 * their soft upper falloff is visible — no hard edges, no seam. They gently
 * drift and pulse. Purely decorative.
 */
export const AmbientGlow = ({
  accentLeft,
  accentRight,
  intensity = 0.55,
  animated = true,
  testID,
}: AmbientGlowProps) => {
  const leftColor = accentLeft ?? DEFAULT_LEFT;
  const rightColor = accentRight ?? DEFAULT_RIGHT;

  // Unique per instance so multiple AmbientGlows can't share gradient IDs and
  // collide in the SVG namespace. `useId` may contain ':' which is invalid in
  // a url(#…) reference, so strip it.
  const uid = useId().replace(/:/g, "");
  const leftId = `ambientGlowLeft-${uid}`;
  const rightId = `ambientGlowRight-${uid}`;

  const reducedMotion = useReducedMotion();
  const isAnimated = animated && !reducedMotion;

  const drift = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!isAnimated) {
      drift.value = 0;
      pulse.value = 0;
      return;
    }
    // Long, gentle ping-pong loops at different periods so the two sources
    // drift independently and never visibly sync up.
    drift.value = withRepeat(withTiming(1, { duration: 5500 }), -1, true);
    pulse.value = withRepeat(withTiming(1, { duration: 4000 }), -1, true);
    return () => {
      cancelAnimation(drift);
      cancelAnimation(pulse);
    };
  }, [isAnimated, drift, pulse]);

  // Only horizontal drift + scale are animated: a full-screen layer's bright
  // bottom edge must never rise above the screen edge, so we avoid translateY
  // and keep scale >= 1 (scaling from center pushes the bottom edge down/off,
  // never up — so no hard seam appears).
  const leftStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + 0.5 * pulse.value,
    transform: [
      { translateX: -90 * drift.value },
      { scale: 1.04 + 0.2 * pulse.value },
    ],
  }));

  const rightStyle = useAnimatedStyle(() => ({
    opacity: 1 - 0.5 * pulse.value,
    transform: [
      { translateX: 90 * drift.value },
      { scale: 1.24 - 0.2 * pulse.value },
    ],
  }));

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      testID={testID}
      accessible={false}
    >
      <Animated.View style={[StyleSheet.absoluteFill, leftStyle]}>
        <RadialGlow
          gradientId={leftId}
          cx="28%"
          cy="106%"
          r="62%"
          color={leftColor}
          intensity={intensity}
        />
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, rightStyle]}>
        <RadialGlow
          gradientId={rightId}
          cx="74%"
          cy="110%"
          r="64%"
          color={rightColor}
          intensity={intensity}
        />
      </Animated.View>
    </View>
  );
};
