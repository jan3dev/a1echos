import { render } from "@testing-library/react-native";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import React from "react";
import { View } from "react-native";

import { useThemeStore } from "@/theme";

import { GlassBlurBackground } from "./GlassBlurBackground";

describe("GlassBlurBackground", () => {
  beforeEach(() => {
    useThemeStore.setState({ currentTheme: "light" });
    (isLiquidGlassAvailable as jest.Mock).mockReturnValue(false);
  });

  it("renders the expo-blur fallback when Liquid Glass is unavailable", () => {
    const json = render(<GlassBlurBackground />).toJSON() as any;
    expect(json.type).toBe("BlurView");
    expect(json.props.tint).toBe("light");
    expect(json.props.blurMethod).toBe("dimezisBlurViewSdk31Plus");
  });

  it("uses a dark tint in dark mode", () => {
    useThemeStore.setState({ currentTheme: "dark" });
    const json = render(<GlassBlurBackground />).toJSON() as any;
    expect(json.props.tint).toBe("dark");
  });

  it("renders Liquid Glass when available", () => {
    (isLiquidGlassAvailable as jest.Mock).mockReturnValue(true);
    const json = render(<GlassBlurBackground />).toJSON() as any;
    expect(json.type).toBe("GlassView");
    expect(json.props.glassEffectStyle).toBe("regular");
    expect(json.props.colorScheme).toBe("light");
  });

  it("uses a dark colorScheme for Liquid Glass in dark mode", () => {
    (isLiquidGlassAvailable as jest.Mock).mockReturnValue(true);
    useThemeStore.setState({ currentTheme: "dark" });
    const json = render(<GlassBlurBackground />).toJSON() as any;
    expect(json.props.colorScheme).toBe("dark");
  });

  it("forwards the blurTarget ref to the fallback BlurView", () => {
    const ref = React.createRef<View>();
    const json = render(
      <GlassBlurBackground blurTarget={ref} />,
    ).toJSON() as any;
    expect(json.props.blurTarget).toBe(ref);
  });
});
