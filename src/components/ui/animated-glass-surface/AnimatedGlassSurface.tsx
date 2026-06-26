import { RefObject, useEffect, useMemo, useRef } from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";

import { useTheme } from "@/theme";

import { GlassBlurBackground } from "../glass-blur-background/GlassBlurBackground";

export interface AnimatedGlassSurfaceProps {
  /**
   * When false the surface is a solid `surfaceBackground` that blends into the
   * screen; when true its glass/blur background fades in over 200ms. Drive from
   * the screen's scroll position so the blur shows only with content behind it.
   */
  scrolled: boolean;
  /**
   * Android only: ref to the screen's `AppBarBlurTarget` wrapping the content
   * that should show through the blur. expo-blur needs this explicit target;
   * iOS blurs natively and ignores it.
   */
  blurTarget?: RefObject<View | null>;
}

/**
 * Scroll-driven glass background shared by the surfaces that float over
 * scrolling content (the top app bar and the bottom sub-screen navbar). Fills
 * its parent — render as the first child of an `overflow: "hidden"` container —
 * and never captures touches.
 *
 * iOS keeps the blur + tint mounted at full opacity and fades an opaque cover
 * in front of it: animating a visual-effect view's own alpha disables the
 * system glass. Android cross-fades the blur + tint over an opaque base.
 */
export const AnimatedGlassSurface = ({
  scrolled,
  blurTarget,
}: AnimatedGlassSurfaceProps) => {
  const { theme } = useTheme();
  const glassOpacity = useRef(new Animated.Value(scrolled ? 1 : 0)).current;
  const didMountRef = useRef(false);

  useEffect(() => {
    // Skip the first run: the value already starts at the correct target, so
    // tweening to it on mount is a wasted no-op that briefly holds the driver.
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    Animated.timing(glassOpacity, {
      toValue: scrolled ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [scrolled, glassOpacity]);

  const iosCoverOpacity = useMemo(
    () => glassOpacity.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    [glassOpacity],
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Platform.OS === "ios" ? (
        <>
          <GlassBlurBackground blurTarget={blurTarget} />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: theme.colors.glassBackground },
            ]}
          />
          {/* Opaque cover faded in front: hides the blur at rest, clears it
              when scrolled. */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: theme.colors.surfaceBackground,
                opacity: iosCoverOpacity,
              },
            ]}
          />
        </>
      ) : (
        <>
          {/* Opaque base for the BlurView to read, then blur + tint cross-faded
              in via opacity. */}
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: theme.colors.surfaceBackground },
            ]}
          />
          <Animated.View
            style={[StyleSheet.absoluteFill, { opacity: glassOpacity }]}
          >
            <GlassBlurBackground blurTarget={blurTarget} />
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: theme.colors.glassBackground },
              ]}
            />
          </Animated.View>
        </>
      )}
    </View>
  );
};
