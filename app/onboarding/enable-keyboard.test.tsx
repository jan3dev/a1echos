/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { Routes } from "@/constants";

import EnableKeyboard from "./enable-keyboard";

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockDismissAll = jest.fn();
const mockCanDismiss = jest.fn(() => true);
jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
    back: mockBack,
    dismissAll: mockDismissAll,
    canDismiss: mockCanDismiss,
  }),
}));

const mockMarkWelcomeSeen = jest.fn();
jest.mock("@/stores", () => ({
  useMarkWelcomeSeen: () => mockMarkWelcomeSeen,
}));

const mockOpenKeyboardSettings = jest.fn();
jest.mock("@/utils", () => ({
  openKeyboardSettings: () => mockOpenKeyboardSettings(),
}));

jest.mock("@/hooks", () => ({
  useLocalization: () => ({
    loc: {
      onboardingSkipConfirmTitle: "Skip Onboarding?",
      onboardingSkipConfirmMessage: "msg",
      onboardingSkip: "Skip",
      cancel: "Cancel",
    },
  }),
}));

jest.mock("@/components", () => {
  const { TouchableOpacity, Text, View } = require("react-native");
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
    Toast: ({
      visible,
      title,
      onPrimaryButtonTap,
      onSecondaryButtonTap,
    }: {
      visible: boolean;
      title: string;
      onPrimaryButtonTap?: () => void;
      onSecondaryButtonTap?: () => void;
    }) =>
      visible ? (
        <View testID="toast">
          <Text>{title}</Text>
          <TouchableOpacity
            testID="toast-primary"
            onPress={onPrimaryButtonTap}
          />
          <TouchableOpacity
            testID="toast-secondary"
            onPress={onSecondaryButtonTap}
          />
        </View>
      ) : null,
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCanDismiss.mockReturnValue(true);
  mockOpenKeyboardSettings.mockResolvedValue(true);
});

describe("EnableKeyboard route", () => {
  it("navigates back on the chevron", () => {
    const { getByTestId } = render(<EnableKeyboard />);
    fireEvent.press(getByTestId("back"));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("opens keyboard settings and finishes onboarding", async () => {
    const { getByTestId } = render(<EnableKeyboard />);
    await act(async () => {
      fireEvent.press(getByTestId("settings"));
    });
    expect(mockOpenKeyboardSettings).toHaveBeenCalledTimes(1);
    expect(mockMarkWelcomeSeen).toHaveBeenCalledTimes(1);
    expect(mockDismissAll).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(Routes.home);
  });

  it("stays on the screen when keyboard settings fail to open", async () => {
    mockOpenKeyboardSettings.mockResolvedValue(false);
    const { getByTestId } = render(<EnableKeyboard />);
    await act(async () => {
      fireEvent.press(getByTestId("settings"));
    });
    expect(mockOpenKeyboardSettings).toHaveBeenCalledTimes(1);
    expect(mockMarkWelcomeSeen).not.toHaveBeenCalled();
    expect(mockDismissAll).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("asks for confirmation before skipping and finishes on confirm", () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <EnableKeyboard />,
    );
    fireEvent.press(getByTestId("skip"));
    expect(getByText("Skip Onboarding?")).toBeTruthy();
    fireEvent.press(getByTestId("toast-primary"));
    expect(mockMarkWelcomeSeen).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(Routes.home);
    expect(queryByTestId("toast")).toBeNull();
  });

  it("cancelling the skip confirmation keeps the user on the screen", () => {
    const { getByTestId, queryByTestId } = render(<EnableKeyboard />);
    fireEvent.press(getByTestId("skip"));
    fireEvent.press(getByTestId("toast-secondary"));
    expect(queryByTestId("toast")).toBeNull();
    expect(mockMarkWelcomeSeen).not.toHaveBeenCalled();
  });

  it("replaces home without dismissing when this is the only screen", async () => {
    mockCanDismiss.mockReturnValue(false);
    const { getByTestId } = render(<EnableKeyboard />);
    await act(async () => {
      fireEvent.press(getByTestId("settings"));
    });
    expect(mockDismissAll).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith(Routes.home);
  });
});
