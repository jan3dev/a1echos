/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";
import React from "react";
import { useSharedValue } from "react-native-reanimated";

import { LockIndicator, LockIndicatorWithSettings } from "./LockIndicator";

jest.mock("../../ui/icon/Icon", () => ({
  Icon: ({ name, ...rest }: { name: string; [key: string]: unknown }) => {
    const { View } = require("react-native");
    return <View testID={`icon-${name}`} {...rest} />;
  },
}));

const mockColors = {
  accentBrand: "#6366F1",
  glassInverse: "rgba(0,0,0,0.1)",
  textInverse: "#FFFFFF",
  textPrimary: "#000000",
  textTertiary: "#999999",
  surfacePrimary: "#FFFFFF",
} as any;

const LockIndicatorWithProgress = (
  props: Omit<React.ComponentProps<typeof LockIndicator>, "progress">,
) => {
  const progress = useSharedValue(1);
  return <LockIndicator progress={progress} {...props} />;
};

const LockIndicatorWithSettingsWrapped = (
  props: Omit<
    React.ComponentProps<typeof LockIndicatorWithSettings>,
    "progress"
  >,
) => {
  const progress = useSharedValue(1);
  return <LockIndicatorWithSettings progress={progress} {...props} />;
};

describe("LockIndicator", () => {
  it("renders lock icon", () => {
    const { getByTestId } = render(
      <LockIndicatorWithProgress colors={mockColors} />,
    );
    expect(getByTestId("icon-lock")).toBeTruthy();
  });

  it("renders chevron_up icon", () => {
    const { getByTestId } = render(
      <LockIndicatorWithProgress colors={mockColors} />,
    );
    expect(getByTestId("icon-chevron_up")).toBeTruthy();
  });

  it("does not render settings icon by default", () => {
    const { queryByTestId } = render(
      <LockIndicatorWithProgress colors={mockColors} />,
    );
    expect(queryByTestId("icon-settings")).toBeNull();
  });

  it("renders settings icon when showSettingsIcon=true", () => {
    const { getByTestId } = render(
      <LockIndicatorWithProgress colors={mockColors} showSettingsIcon={true} />,
    );
    expect(getByTestId("icon-settings")).toBeTruthy();
  });

  it("LockIndicatorWithSettings renders with settings icon", () => {
    const { getByTestId } = render(
      <LockIndicatorWithSettingsWrapped colors={mockColors} />,
    );
    expect(getByTestId("icon-settings")).toBeTruthy();
    expect(getByTestId("icon-lock")).toBeTruthy();
    expect(getByTestId("icon-chevron_up")).toBeTruthy();
  });
});
