import { useEffect, useId, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
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
 * Elliptical radial fill in pixel space. A screen-sized SVG clips an opaque
 * circle into a hard rectangle once drift/scale slides it; the caller paints
 * this on an overscanned canvas so those edges stay off-screen.
 */
const RadialGlow = ({
  gradientId,
  svgWidth,
  svgHeight,
  cx,
  cy,
  rx,
  ry,
  color,
  intensity,
}: {
  gradientId: string;
  svgWidth: number;
  svgHeight: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color: string;
  intensity: number;
}) => (
  <Svg width={svgWidth} height={svgHeight}>
    <Defs>
      <RadialGradient
        id={gradientId}
        gradientUnits="userSpaceOnUse"
        cx={0}
        cy={0}
        r={1}
        gradientTransform={`translate(${cx}, ${cy}) scale(${rx}, ${ry})`}
      >
        <Stop offset="0" stopColor={color} stopOpacity={intensity} />
        <Stop offset="0.55" stopColor={color} stopOpacity={intensity * 0.35} />
        <Stop offset="1" stopColor={color} stopOpacity={0} />
      </RadialGradient>
    </Defs>
    <Rect
      x={0}
      y={0}
      width={svgWidth}
      height={svgHeight}
      fill={`url(#${gradientId})`}
    />
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
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

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

  const { width, height } = size;
  const ready = width > 0 && height > 0;
  // Ellipse: 62% of each axis like the original objectBoundingBox glow, but
  // never thinner than 35% of the longer side so landscape doesn't collapse.
  const rx = Math.max(width * 0.62, height * 0.35);
  const ry = Math.max(height * 0.62, width * 0.35);
  // Drift is ±90 and scale goes to 1.24; pad past the ellipse so the SVG
  // rect never shows as a hard edge inside the screen.
  const padX = rx + 90;
  const padY = ry + 40;
  const svgWidth = width + padX * 2;
  const svgHeight = height + padY * 2;
  const canvasStyle = {
    position: "absolute" as const,
    left: -padX,
    top: -padY,
    width: svgWidth,
    height: svgHeight,
  };

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.clip]}
      pointerEvents="none"
      testID={testID}
      accessible={false}
      onLayout={onLayout}
    >
      {ready ? (
        <>
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.clip, leftStyle]}
          >
            <View style={canvasStyle}>
              <RadialGlow
                gradientId={leftId}
                svgWidth={svgWidth}
                svgHeight={svgHeight}
                cx={padX + width * 0.28}
                cy={padY + height * 1.06}
                rx={rx}
                ry={ry}
                color={leftColor}
                intensity={intensity}
              />
            </View>
          </Animated.View>

          <Animated.View
            style={[StyleSheet.absoluteFill, styles.clip, rightStyle]}
          >
            <View style={canvasStyle}>
              <RadialGlow
                gradientId={rightId}
                svgWidth={svgWidth}
                svgHeight={svgHeight}
                cx={padX + width * 0.74}
                cy={padY + height * 1.1}
                rx={rx * 1.03}
                ry={ry * 1.03}
                color={rightColor}
                intensity={intensity}
              />
            </View>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  clip: {
    overflow: "visible",
  },
});
