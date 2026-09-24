/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { Routes } from "@/constants";

import AllowMicrophone from "./allow-microphone";

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

const mockEnsureMicPermission = jest.fn();
const mockConfirmSkip = jest.fn();
jest.mock("@/hooks", () => ({
  useMicPermission: () => mockEnsureMicPermission,
  useOnboardingExit: () => ({
    finishOnboarding: jest.fn(),
    confirmSkip: mockConfirmSkip,
  }),
}));

jest.mock("@/components", () => {
  const { TouchableOpacity, View } = require("react-native");
  return {
    AllowMicrophoneScreen: ({
      onBack,
      onSkip,
      onAllow,
    }: {
      onBack: () => void;
      onSkip: () => void;
      onAllow: () => void;
    }) => (
      <View>
        <TouchableOpacity testID="back" onPress={onBack} />
        <TouchableOpacity testID="skip" onPress={onSkip} />
        <TouchableOpacity testID="allow" onPress={onAllow} />
      </View>
    ),
    Toast: () => null,
  };
});

beforeEach(() => jest.clearAllMocks());

describe("AllowMicrophone route", () => {
  it("wires back and skip", () => {
    const { getByTestId } = render(<AllowMicrophone />);
    fireEvent.press(getByTestId("back"));
    fireEvent.press(getByTestId("skip"));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockConfirmSkip).toHaveBeenCalledTimes(1);
  });

  it("advances to the keyboard step when permission is granted", async () => {
    mockEnsureMicPermission.mockResolvedValue(true);
    const { getByTestId } = render(<AllowMicrophone />);
    await act(async () => {
      fireEvent.press(getByTestId("allow"));
    });
    expect(mockPush).toHaveBeenCalledWith(Routes.onboardingEnableKeyboard);
  });

  it("stays on the screen when permission is not granted", async () => {
    mockEnsureMicPermission.mockResolvedValue(false);
    const { getByTestId } = render(<AllowMicrophone />);
    await act(async () => {
      fireEvent.press(getByTestId("allow"));
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});
