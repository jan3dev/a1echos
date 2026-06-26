import { render } from "@testing-library/react-native";
import React from "react";
import { View } from "react-native";

import { useThemeStore } from "@/theme";

import { GlassBlurBackground } from "./GlassBlurBackground";

describe("GlassBlurBackground", () => {
  beforeEach(() => {
    useThemeStore.setState({ currentTheme: "light" });
  });

  it("renders an expo-blur BlurView", () => {
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

  it("forwards the blurTarget ref to the BlurView", () => {
    const ref = React.createRef<View>();
    const json = render(
      <GlassBlurBackground blurTarget={ref} />,
    ).toJSON() as any;
    expect(json.props.blurTarget).toBe(ref);
  });
});
