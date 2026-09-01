/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";

import { LargerModelSuggestionModal } from "./LargerModelSuggestionModal";

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

jest.mock("../../../ui/icon/Icon", () => {
  const { View } = require("react-native");
  return { Icon: () => <View testID="suggestion-icon" /> };
});

describe("LargerModelSuggestionModal", () => {
  const onConfirm = jest.fn();
  const onDismiss = jest.fn();

  const renderSheet = (visible: boolean) =>
    render(
      <LargerModelSuggestionModal
        visible={visible}
        languageName="German"
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not render when visible is false", () => {
    const { queryByTestId } = renderSheet(false);
    expect(queryByTestId(TestID.LargerModelSuggestionModal)).toBeNull();
  });

  it("renders the sheet with title and body when visible", () => {
    const { getByTestId, getByText } = renderSheet(true);
    expect(getByTestId(TestID.LargerModelSuggestionModal)).toBeTruthy();
    expect(getByText("largerModelSuggestionTitle")).toBeTruthy();
    expect(getByText("largerModelSuggestionBody")).toBeTruthy();
  });

  it("calls onConfirm when the CTA is pressed", () => {
    const { getByTestId } = renderSheet(true);
    fireEvent.press(getByTestId("primary-button"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("calls onDismiss when the secondary button is pressed", () => {
    const { getByTestId } = renderSheet(true);
    fireEvent.press(getByTestId("secondary-button"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onDismiss when the backdrop is pressed", () => {
    const { getByTestId } = renderSheet(true);
    fireEvent.press(getByTestId("dimmer-backdrop"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
