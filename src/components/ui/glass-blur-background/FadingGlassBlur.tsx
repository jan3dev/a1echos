import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import {
  GlassBlurBackground,
  GlassBlurBackgroundProps,
} from "./GlassBlurBackground";

export interface FadingGlassBlurProps extends GlassBlurBackgroundProps {
  /** Offset from the parent's top where the fade-in starts. */
  top?: number;
  /**
   * Length of the fade-in; the blur is at full strength below it. Span the
   * control so everything beneath it is evenly blurred.
   */
  fadeHeight: number;
}

/**
 * Glass blur + tint filling its parent from `top` down, faded in from
 * transparent so it has no visible top edge. Backs the controls pinned to the
 * bottom of a screen over scrolling content.
 */
export const FadingGlassBlur = ({
  blurTarget,
  top = 0,
  fadeHeight,
}: FadingGlassBlurProps) => {
  return (
    <MaskedView
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { top }]}
      maskElement={
        <View style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={["transparent", "black"]}
            style={{ height: fadeHeight }}
          />
          <View style={styles.solid} />
        </View>
      }
    >
      <GlassBlurBackground blurTarget={blurTarget} />
    </MaskedView>
  );
};

const styles = StyleSheet.create({
  solid: {
    flex: 1,
    backgroundColor: "black",
  },
});
