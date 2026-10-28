import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Platform, processColor, Text } from "react-native";

import { lightColors } from "@/theme";

import { RipplePressable } from "./RipplePressable";

const rippleOf = (root: ReturnType<typeof render>) =>
  root.getByTestId("rp").props.nativeForegroundAndroid;

describe("RipplePressable", () => {
  beforeEach(() => {
    Object.defineProperty(Platform, "OS", { get: () => "android" });
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", { get: () => "ios" });
  });

  it("renders children and calls onPress", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <RipplePressable onPress={onPress}>
        <Text>Press Me</Text>
      </RipplePressable>,
    );
    fireEvent.press(getByText("Press Me"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("defaults to the theme ripple in the foreground", () => {
    const root = render(
      <RipplePressable testID="rp">
        <Text>Default</Text>
      </RipplePressable>,
    );
    expect(rippleOf(root)).toMatchObject({
      type: "RippleAndroid",
      color: processColor(lightColors.ripple),
      borderless: false,
    });
  });

  it("uses the given color and borderless", () => {
    const root = render(
      <RipplePressable testID="rp" rippleColor="#000" borderless>
        <Text>Borderless</Text>
      </RipplePressable>,
    );
    expect(rippleOf(root)).toMatchObject({
      color: processColor("#000"),
      borderless: true,
    });
  });

  it("passes style functions and onLongPress through", () => {
    const onLongPress = jest.fn();
    const style = jest.fn(() => ({ opacity: 1 }));
    const { getByText } = render(
      <RipplePressable onLongPress={onLongPress} style={style}>
        <Text>Long Press</Text>
      </RipplePressable>,
    );
    fireEvent(getByText("Long Press"), "longPress");
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(style).toHaveBeenCalledWith(
      expect.objectContaining({ pressed: false }),
    );
  });

  it("doesn't fire when disabled", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <RipplePressable disabled onPress={onPress}>
        <Text>Disabled</Text>
      </RipplePressable>,
    );
    fireEvent.press(getByText("Disabled"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
