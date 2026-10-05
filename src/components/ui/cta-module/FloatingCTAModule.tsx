import { RefObject } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing } from "@/theme";

import { PRIMARY_BUTTON_HEIGHT } from "../button/Button";
import { FadingGlassBlur } from "../glass-blur-background/FadingGlassBlur";

import { CTAModule, CTAModuleProps } from "./CTAModule";

export interface FloatingCTAModuleProps extends CTAModuleProps {
  /**
   * Android only: ref to the screen's `AppBarBlurTarget` wrapping the content
   * that scrolls behind the buttons.
   */
  blurTarget?: RefObject<View | null>;
}

/**
 * `CTAModule` pinned to the bottom of the screen over scrolling content. Its
 * glass blur fades in across the primary button, from its top edge to full
 * strength at its bottom edge, so everything below is evenly blurred.
 * Render as the last child of the screen so it sits above the scroll view.
 */
export const FloatingCTAModule = ({
  blurTarget,
  ...ctaProps
}: FloatingCTAModuleProps) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom + spacing.md,
          paddingLeft: insets.left + spacing.md,
          paddingRight: insets.right + spacing.md,
        },
      ]}
    >
      <FadingGlassBlur
        blurTarget={blurTarget}
        fadeHeight={PRIMARY_BUTTON_HEIGHT}
      />
      <CTAModule {...ctaProps} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
});
