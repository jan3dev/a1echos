import { useIsFocused } from "expo-router";
import {
  Canvas,
  Group,
  RadialGradient,
  Rect,
  Skia,
  vec,
} from "@shopify/react-native-skia";
import { useEffect, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import {
  cancelAnimation,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

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

const glowStops = (color: string, intensity: number) => {
  const [r, g, b, a] = Skia.Color(color);
  return [intensity, intensity * 0.35, 0].map((o) =>
    Float32Array.of(r, g, b, a * o),
  );
};
const GLOW_POSITIONS = [0, 0.55, 1];

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

  const reducedMotion = useReducedMotion();
  const isAnimated = animated && !reducedMotion;
  // Covered stack screens stay mounted, so freeze the loops while hidden.
  const isFocused = useIsFocused();
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
    if (!isFocused) return;
    // Long, gentle ping-pong loops at different periods so the two sources
    // drift independently and never visibly sync up. A refocus first eases
    // back from wherever the blur froze them so the glow doesn't jump.
    const loop = (sv: typeof drift, duration: number) => {
      sv.value = withSequence(
        withTiming(0, { duration: duration * sv.value }),
        withRepeat(withTiming(1, { duration }), -1, true),
      );
    };
    loop(drift, 5500);
    loop(pulse, 4000);
    return () => {
      cancelAnimation(drift);
      cancelAnimation(pulse);
    };
  }, [isAnimated, isFocused, drift, pulse]);

  // Only horizontal drift + scale are animated: a full-screen layer's bright
  // bottom edge must never rise above the screen edge, so we avoid translateY
  // and keep scale >= 1 (scaling from center pushes the bottom edge down/off,
  // never up — so no hard seam appears).
  const leftTransform = useDerivedValue(() => [
    { translateX: -90 * drift.value },
    { scale: 1.04 + 0.2 * pulse.value },
  ]);
  const leftOpacity = useDerivedValue(() => 0.5 + 0.5 * pulse.value);
  const rightTransform = useDerivedValue(() => [
    { translateX: 90 * drift.value },
    { scale: 1.24 - 0.2 * pulse.value },
  ]);
  const rightOpacity = useDerivedValue(() => 1 - 0.5 * pulse.value);

  const { width, height } = size;
  const ready = width > 0 && height > 0;
  // Ellipse: 62% of each axis like the original objectBoundingBox glow, but
  // never thinner than 35% of the longer side so landscape doesn't collapse.
  const rx = Math.max(width * 0.62, height * 0.35);
  const ry = Math.max(height * 0.62, width * 0.35);
  const origin = vec(width / 2, height / 2);
  // Drift is ±90 and scale goes to 1.24; overdraw past the ellipse so the
  // fill never shows a hard edge inside the canvas. Skia clips it for free.
  const fill = {
    x: -(rx + 90),
    y: -(ry + 40),
    width: width + 2 * (rx + 90),
    height: height + 2 * (ry + 40),
  };
  const leftCenter = vec(width * 0.28, height * 1.06);
  const rightCenter = vec(width * 0.74, height * 1.1);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      testID={testID}
      accessible={false}
      onLayout={onLayout}
    >
      {ready ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Group
            transform={leftTransform}
            origin={origin}
            opacity={leftOpacity}
          >
            <Rect {...fill}>
              <RadialGradient
                c={leftCenter}
                r={ry}
                transform={[{ scaleX: rx / ry }]}
                origin={leftCenter}
                colors={glowStops(leftColor, intensity)}
                positions={GLOW_POSITIONS}
              />
            </Rect>
          </Group>
          <Group
            transform={rightTransform}
            origin={origin}
            opacity={rightOpacity}
          >
            <Rect {...fill}>
              <RadialGradient
                c={rightCenter}
                r={ry * 1.03}
                transform={[{ scaleX: rx / ry }]}
                origin={rightCenter}
                colors={glowStops(rightColor, intensity)}
                positions={GLOW_POSITIONS}
              />
            </Rect>
          </Group>
        </Canvas>
      ) : null}
    </View>
  );
};
