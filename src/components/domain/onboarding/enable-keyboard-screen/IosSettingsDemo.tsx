import {
  Canvas,
  Group,
  Skia,
  Skottie,
  type SkSkottieAnimation,
} from "@shopify/react-native-skia";
import { StyleSheet } from "react-native";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";

import { useLocalization } from "@/hooks";

import { type DemoProps, LIST_MAX_WIDTH } from "./walkthrough";

const ANIMATION_JSON = require("@/assets/animations/enable-keyboard.json");
const animations: { dark?: SkSkottieAnimation; light?: SkSkottieAnimation } =
  {};
// Light is derived by scripts/generate-light-enable-keyboard-animation.js.
const animationFor = (dark: boolean) =>
  dark
    ? (animations.dark ??= Skia.Skottie.Make(JSON.stringify(ANIMATION_JSON)))
    : (animations.light ??= Skia.Skottie.Make(
        JSON.stringify(
          require("@/assets/animations/enable-keyboard-light.json"),
        ),
      ));

// Frames from the "reset" marker on only rewind the demo for looping.
const LAST_FRAME: number = ANIMATION_JSON.markers.find(
  (m: { cm: string }) => m.cm === "reset",
).tm;
export const IOS_DEMO_DONE = (LAST_FRAME / ANIMATION_JSON.fr) * 1000;

// The 375×812 comp is mostly empty; crop to the list, tooltip and cursor.
const CROP_X = 16;
const CROP_Y = 288;
const CROP_HEIGHT = 432;

/** Settings → Keyboards → Echos on, Allow Full Access on. */
export function IosSettingsDemo({ t, dark, testID }: DemoProps) {
  const { loc } = useLocalization();
  const canvasSize = useSharedValue({
    width: LIST_MAX_WIDTH,
    height: CROP_HEIGHT,
  });
  const frame = useDerivedValue(() =>
    Math.min((t.value / 1000) * ANIMATION_JSON.fr, LAST_FRAME),
  );
  const transform = useDerivedValue(() => [
    { scale: canvasSize.value.width / LIST_MAX_WIDTH },
    { translateX: -CROP_X },
    { translateY: -CROP_Y },
  ]);

  return (
    <Canvas
      testID={testID ? `${testID}-animation` : undefined}
      style={styles.canvas}
      onSize={canvasSize}
      accessible
      accessibilityRole="image"
      accessibilityLabel={loc.onboardingEnableKeyboardTooltip}
    >
      <Group transform={transform}>
        <Skottie animation={animationFor(dark)} frame={frame} />
      </Group>
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {
    width: "100%",
    maxWidth: LIST_MAX_WIDTH,
    aspectRatio: LIST_MAX_WIDTH / CROP_HEIGHT,
  },
});
