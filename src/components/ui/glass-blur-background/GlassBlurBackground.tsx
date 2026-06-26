import { BlurView } from "expo-blur";
import { RefObject } from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "@/theme";

// Blur strength for the bars. Kept low: expo-blur derives a translucent tint
// overlay whose opacity scales with intensity, so a high value reads as a panel
// brighter than the background even with nothing behind it. This keeps the
// surface subtle and lets the blur show the content scrolled behind it.
const BLUR_INTENSITY = 20;

export interface GlassBlurBackgroundProps {
  /**
   * Android only: ref to the `AppBarBlurTarget` wrapping the content that should
   * show through this surface. expo-blur needs an explicit target to blur
   * underlying views; iOS blurs natively and ignores it.
   */
  blurTarget?: RefObject<View | null>;
}

/**
 * Absolutely-filling native blur background shared by the surfaces that float
 * over scrolling content (the top app bar and the bottom sub-screen navbar).
 *
 * Render as the first child of an `overflow: "hidden"` container, behind the
 * surface's own content.
 */
export const GlassBlurBackground = ({
  blurTarget,
}: GlassBlurBackgroundProps) => {
  const { isDark } = useTheme();

  return (
    <BlurView
      style={StyleSheet.absoluteFill}
      intensity={BLUR_INTENSITY}
      tint={isDark ? "dark" : "light"}
      blurMethod="dimezisBlurViewSdk31Plus"
      blurTarget={blurTarget}
    />
  );
};
