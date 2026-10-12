import {
  Blur,
  Canvas,
  Circle,
  ColorMatrix,
  FractalNoise,
  Group,
  LinearGradient,
  Rect,
  vec,
} from "@shopify/react-native-skia";
import { useEffect } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { AquaPrimitiveColors } from "@/theme";

// Blob geometry is specced on a 375-wide Figma frame.
const SPEC_WIDTH = 375;
// Blobs only drift from their Figma spot toward the screen center, so the
// dark Unlock pill's edge never ends up on darker gradient than the design.
const DRIFT = 24;
const LOOP_MS = 24000;
const MIXED_COLORS = ["#A54CFF", "#4588D2", "#FBCAB9"];
// Figma's grain: 25% white wherever noise luminance < 0.51. A steep clamped
// ramp approximates the threshold, since a color matrix can't step.
const GRAIN_GAIN = 20;
// prettier-ignore
const GRAIN_MATRIX = [
  0, 0, 0, 0, 1,
  0, 0, 0, 0, 1,
  0, 0, 0, 0, 1,
  -0.2125 * GRAIN_GAIN, -0.7154 * GRAIN_GAIN, -0.0721 * GRAIN_GAIN, 0, 0.51 * GRAIN_GAIN,
];
// Paint opacity is applied before color filters, so the 25% is a second matrix.
// prettier-ignore
const GRAIN_OPACITY_MATRIX = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 0.25, 0,
];

export const UnlockGradient = () => {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    t.value = withRepeat(
      withTiming(1, { duration: LOOP_MS, easing: Easing.linear }),
      -1,
    );
    return () => cancelAnimation(t);
  }, [t, reduceMotion]);

  // Integer frequencies keep the Lissajous loop seamless at t = 1 → 0;
  // (1 - cos) / 2 eases 0 → 1 → 0 so each axis starts at the design spot.
  const blueDrift = useDerivedValue(() => {
    const a = 2 * Math.PI * t.value;
    return [
      { translateX: (-DRIFT * (1 - Math.cos(2 * a))) / 2 },
      { translateY: (-DRIFT * (1 - Math.cos(3 * a))) / 2 },
    ];
  });
  const mixedDrift = useDerivedValue(() => {
    const a = 2 * Math.PI * t.value;
    return [
      { translateX: (DRIFT * (1 - Math.cos(3 * a))) / 2 },
      { translateY: (-DRIFT * (1 - Math.cos(2 * a))) / 2 },
    ];
  });

  const s = Math.min(width, height) / SPEC_WIDTH;
  const blue = { cx: width * 0.98, cy: height * 0.669, r: 166.5 * s };
  const mixed = { cx: width * 0.1, cy: height * 0.86, r: 176.5 * s };

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group transform={blueDrift}>
        <Circle {...blue} color={AquaPrimitiveColors.neonBlue400}>
          <Blur blur={80 * s} />
        </Circle>
      </Group>
      <Group transform={mixedDrift}>
        <Circle {...mixed}>
          <LinearGradient
            start={vec(mixed.cx - mixed.r, mixed.cy - mixed.r)}
            end={vec(mixed.cx + mixed.r, mixed.cy + mixed.r)}
            colors={MIXED_COLORS}
          />
          <Blur blur={100 * s} />
        </Circle>
      </Group>
      {/* srcATop clips the grain to the blobs, like Figma's noise effect. */}
      <Rect x={0} y={0} width={width} height={height} blendMode="srcATop">
        <FractalNoise freqX={2} freqY={2} octaves={3} />
        <ColorMatrix matrix={GRAIN_OPACITY_MATRIX}>
          <ColorMatrix matrix={GRAIN_MATRIX} />
        </ColorMatrix>
      </Rect>
    </Canvas>
  );
};
