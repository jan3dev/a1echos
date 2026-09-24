/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { Routes } from "@/constants";

import EnableKeyboard from "./enable-keyboard";

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

const mockOpenKeyboardSettings = jest.fn();
jest.mock("@/utils", () => ({
  openKeyboardSettings: () => mockOpenKeyboardSettings(),
}));

const mockConfirmSkip = jest.fn();
jest.mock("@/hooks", () => ({
  useOnboardingExit: () => ({
    finishOnboarding: jest.fn(),
    confirmSkip: mockConfirmSkip,
  }),
}));

jest.mock("@/components", () => {
  const { TouchableOpacity, View } = require("react-native");
  return {
    EnableKeyboardScreen: ({
      onBack,
      onSkip,
      onGoToSettings,
    }: {
      onBack: () => void;
      onSkip: () => void;
      onGoToSettings: () => void;
    }) => (
      <View>
        <TouchableOpacity testID="back" onPress={onBack} />
        <TouchableOpacity testID="skip" onPress={onSkip} />
        <TouchableOpacity testID="settings" onPress={onGoToSettings} />
      </View>
    ),
    Toast: () => null,
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockOpenKeyboardSettings.mockResolvedValue(true);
});

describe("EnableKeyboard route", () => {
  it("wires back and skip", () => {
    const { getByTestId } = render(<EnableKeyboard />);
    fireEvent.press(getByTestId("back"));
    fireEvent.press(getByTestId("skip"));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockConfirmSkip).toHaveBeenCalledTimes(1);
  });

  it("opens keyboard settings and continues to the language step", async () => {
    const { getByTestId } = render(<EnableKeyboard />);
    await act(async () => {
      fireEvent.press(getByTestId("settings"));
    });
    expect(mockOpenKeyboardSettings).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(Routes.onboardingSpokenLanguage);
  });

  it("stays on the screen when keyboard settings fail to open", async () => {
    mockOpenKeyboardSettings.mockResolvedValue(false);
    const { getByTestId } = render(<EnableKeyboard />);
    await act(async () => {
      fireEvent.press(getByTestId("settings"));
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});
