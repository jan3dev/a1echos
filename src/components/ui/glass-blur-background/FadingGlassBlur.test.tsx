import { render } from "@testing-library/react-native";
import React from "react";
import { StyleSheet, View } from "react-native";

import { darkColors, useThemeStore } from "@/theme";

import { FadingGlassBlur } from "./FadingGlassBlur";

describe("FadingGlassBlur", () => {
  beforeEach(() => {
    useThemeStore.setState({ currentTheme: "dark" });
  });

  it("masks the blur and glass tint with a fade starting at `top`", () => {
    const blurTarget = React.createRef<View>();
    const { UNSAFE_getByType, UNSAFE_getAllByType, toJSON } = render(
      <FadingGlassBlur blurTarget={blurTarget} top={-28} fadeHeight={56} />,
    );
    const root = toJSON() as any;
    expect(StyleSheet.flatten(root.props.style)).toMatchObject({
      position: "absolute",
      top: -28,
      bottom: 0,
    });
    const fade = UNSAFE_getAllByType("LinearGradient" as any)[0];
    expect(fade.props.colors).toEqual(["transparent", "black"]);
    expect(fade.props.style).toEqual({ height: 56 });
    expect(UNSAFE_getByType("BlurView" as any).props.blurTarget).toBe(
      blurTarget,
    );
    expect(JSON.stringify(root)).toContain(darkColors.glassBackground);
  });
});
