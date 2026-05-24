import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import * as Reanimated from "react-native-reanimated";

import { ScrollToEdgeButton } from "./ScrollToEdgeButton";

describe("ScrollToEdgeButton", () => {
  it("renders with accessibility label", () => {
    const { getByLabelText } = render(
      <ScrollToEdgeButton
        visible
        direction="down"
        onPress={jest.fn()}
        accessibilityLabel="Scroll down"
      />,
    );
    expect(getByLabelText("Scroll down")).toBeTruthy();
  });

  it("fires onPress when visible", () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <ScrollToEdgeButton
        visible
        direction="down"
        onPress={onPress}
        accessibilityLabel="Scroll down"
      />,
    );
    fireEvent.press(getByLabelText("Scroll down"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("blocks pointer events when hidden", () => {
    const { getByTestId } = render(
      <ScrollToEdgeButton
        visible={false}
        direction="up"
        onPress={jest.fn()}
        accessibilityLabel="Scroll up"
        testID="scroll-edge"
      />,
    );
    expect(getByTestId("scroll-edge").props.pointerEvents).toBe("none");
  });

  it("allows pointer events when visible", () => {
    const { getByTestId } = render(
      <ScrollToEdgeButton
        visible
        direction="up"
        onPress={jest.fn()}
        accessibilityLabel="Scroll up"
        testID="scroll-edge"
      />,
    );
    expect(getByTestId("scroll-edge").props.pointerEvents).toBe("auto");
  });

  it("animated style worklet returns opacity and transform from progress", () => {
    let capturedWorklet: (() => unknown) | null = null;
    const useAnimatedStyleMock = Reanimated.useAnimatedStyle as jest.Mock;
    useAnimatedStyleMock.mockImplementationOnce((fn: () => unknown) => {
      capturedWorklet = fn;
      return fn();
    });

    render(
      <ScrollToEdgeButton
        visible
        direction="down"
        onPress={jest.fn()}
        accessibilityLabel="Scroll"
      />,
    );

    expect(capturedWorklet).not.toBeNull();
    const style = capturedWorklet!() as {
      opacity: number;
      transform: { scale: number }[];
    };
    expect(style.opacity).toBeDefined();
    expect(style.transform[0].scale).toBeDefined();
  });

  it("renders both directions", () => {
    const { getByLabelText, rerender } = render(
      <ScrollToEdgeButton
        visible
        direction="up"
        onPress={jest.fn()}
        accessibilityLabel="Scroll up"
      />,
    );
    expect(getByLabelText("Scroll up")).toBeTruthy();

    rerender(
      <ScrollToEdgeButton
        visible
        direction="down"
        onPress={jest.fn()}
        accessibilityLabel="Scroll down"
      />,
    );
    expect(getByLabelText("Scroll down")).toBeTruthy();
  });
});
