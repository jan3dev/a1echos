import { render } from "@testing-library/react-native";
import React from "react";
import { View } from "react-native";

import { lightColors, useThemeStore } from "@/theme";

import { GlassBlurBackground } from "./GlassBlurBackground";

describe("GlassBlurBackground", () => {
  beforeEach(() => {
    useThemeStore.setState({ currentTheme: "light" });
  });

  it("renders an expo-blur BlurView under the glass tint", () => {
    const [blur, tint] = render(<GlassBlurBackground />).toJSON() as any;
    expect(blur.type).toBe("BlurView");
    expect(blur.props.tint).toBe("light");
    expect(blur.props.blurMethod).toBe("dimezisBlurViewSdk31Plus");
    expect(JSON.stringify(tint.props.style)).toContain(
      lightColors.glassBackground,
    );
  });

  it("uses a dark tint in dark mode", () => {
    useThemeStore.setState({ currentTheme: "dark" });
    const [blur] = render(<GlassBlurBackground />).toJSON() as any;
    expect(blur.props.tint).toBe("dark");
  });

  it("forwards the blurTarget ref to the BlurView", () => {
    const ref = React.createRef<View>();
    const [blur] = render(<GlassBlurBackground blurTarget={ref} />).toJSON() as any;
    expect(blur.props.blurTarget).toBe(ref);
  });
});
