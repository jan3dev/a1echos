/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Platform } from "react-native";

import { TestID } from "@/constants";

import { KeyboardPromptModal } from "./KeyboardPromptModal";

jest.mock("../../../ui/modal/Dimmer", () => ({
  Dimmer: ({ visible, children, onDismiss }: any) => {
    const { View, Pressable } = require("react-native");
    if (!visible) return null;
    return (
      <View testID="dimmer">
        <Pressable testID="dimmer-backdrop" onPress={onDismiss} />
        {children}
      </View>
    );
  },
}));

jest.mock("../../../ui/button/Button", () => {
  const { Pressable, Text } = require("react-native");
  return {
    Button: {
      primary: ({ text, onPress }: any) => (
        <Pressable testID="primary-button" onPress={onPress}>
          <Text>{text}</Text>
        </Pressable>
      ),
      secondary: ({ text, onPress }: any) => (
        <Pressable testID="secondary-button" onPress={onPress}>
          <Text>{text}</Text>
        </Pressable>
      ),
    },
  };
});

const setPlatform = (os: "ios" | "android") => {
  Object.defineProperty(Platform, "OS", {
    value: os,
    writable: true,
    configurable: true,
  });
};

describe("KeyboardPromptModal", () => {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    setPlatform("ios");
  });

  it("does not render when visible is false", () => {
    const { queryByTestId } = render(
      <KeyboardPromptModal
        visible={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(queryByTestId(TestID.KeyboardPromptModal)).toBeNull();
  });

  it("renders sheet when visible", () => {
    const { getByTestId } = render(
      <KeyboardPromptModal
        visible={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(getByTestId(TestID.KeyboardPromptModal)).toBeTruthy();
  });

  it("renders title and body from localization", () => {
    const { getByText } = render(
      <KeyboardPromptModal
        visible={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(getByText("keyboardPromptTitle")).toBeTruthy();
    expect(getByText("keyboardPromptBody")).toBeTruthy();
  });

  it("renders primary CTA and calls onConfirm", () => {
    const { getByTestId, getByText } = render(
      <KeyboardPromptModal
        visible={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(getByText("keyboardPromptCta")).toBeTruthy();
    fireEvent.press(getByTestId("primary-button"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("renders secondary CTA and calls onCancel", () => {
    const { getByTestId, getByText } = render(
      <KeyboardPromptModal
        visible={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(getByText("keyboardPromptDismiss")).toBeTruthy();
    fireEvent.press(getByTestId("secondary-button"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("dimmer dismiss calls onCancel", () => {
    const { getByTestId } = render(
      <KeyboardPromptModal
        visible={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.press(getByTestId("dimmer-backdrop"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("renders the iOS keyboard image on iOS", () => {
    setPlatform("ios");
    const { getByTestId } = render(
      <KeyboardPromptModal
        visible={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(getByTestId("keyboard-prompt-image-ios")).toBeTruthy();
  });

  it("renders the Android keyboard image on Android", () => {
    setPlatform("android");
    const { getByTestId } = render(
      <KeyboardPromptModal
        visible={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(getByTestId("keyboard-prompt-image-android")).toBeTruthy();
  });

  it("shows the iOS disclaimer on iOS", () => {
    setPlatform("ios");
    const { getByText } = render(
      <KeyboardPromptModal
        visible={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(getByText("keyboardPromptIosDisclaimer")).toBeTruthy();
  });

  it("does not show the iOS disclaimer on Android", () => {
    setPlatform("android");
    const { queryByText } = render(
      <KeyboardPromptModal
        visible={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(queryByText("keyboardPromptIosDisclaimer")).toBeNull();
  });
});
