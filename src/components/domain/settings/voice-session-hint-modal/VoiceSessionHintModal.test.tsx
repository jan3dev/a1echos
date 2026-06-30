/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";

import { VoiceSessionHintModal } from "./VoiceSessionHintModal";

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
  return { Icon: () => <View testID="hint-icon" /> };
});

describe("VoiceSessionHintModal", () => {
  const onDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not render when visible is false", () => {
    const { queryByTestId } = render(
      <VoiceSessionHintModal visible={false} onDismiss={onDismiss} />,
    );
    expect(queryByTestId(TestID.VoiceSessionHintModal)).toBeNull();
  });

  it("renders the sheet with title and body when visible", () => {
    const { getByTestId, getByText } = render(
      <VoiceSessionHintModal visible={true} onDismiss={onDismiss} />,
    );
    expect(getByTestId(TestID.VoiceSessionHintModal)).toBeTruthy();
    expect(getByText("voiceSessionHintTitle")).toBeTruthy();
    expect(getByText("voiceSessionHintBody")).toBeTruthy();
  });

  it("calls onDismiss when the CTA is pressed", () => {
    const { getByTestId, getByText } = render(
      <VoiceSessionHintModal visible={true} onDismiss={onDismiss} />,
    );
    expect(getByText("voiceSessionHintCta")).toBeTruthy();
    fireEvent.press(getByTestId("primary-button"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when the backdrop is pressed", () => {
    const { getByTestId } = render(
      <VoiceSessionHintModal visible={true} onDismiss={onDismiss} />,
    );
    fireEvent.press(getByTestId("dimmer-backdrop"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
