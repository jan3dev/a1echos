/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { Routes } from "@/constants";

import AllowMicrophone from "./allow-microphone";

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

const mockEnsureMicPermission = jest.fn();
jest.mock("@/hooks", () => ({
  useLocalization: () => ({
    loc: {
      onboardingSkipConfirmTitle: "Skip Onboarding?",
      onboardingSkipConfirmMessage: "msg",
      onboardingSkip: "Skip",
      cancel: "Cancel",
    },
  }),
  useMicPermission: () => mockEnsureMicPermission,
}));

jest.mock("@/components", () => {
  const { TouchableOpacity, Text, View } = require("react-native");
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
});

describe("AllowMicrophone route", () => {
  it("navigates back on the chevron", () => {
    const { getByTestId } = render(<AllowMicrophone />);
    fireEvent.press(getByTestId("back"));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("finishes onboarding when permission is granted", async () => {
    mockEnsureMicPermission.mockResolvedValue(true);
    const { getByTestId } = render(<AllowMicrophone />);
    await act(async () => {
      fireEvent.press(getByTestId("allow"));
    });
    expect(mockMarkWelcomeSeen).toHaveBeenCalledTimes(1);
    expect(mockDismissAll).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(Routes.home);
  });

  it("stays on the screen when permission is not granted", async () => {
    mockEnsureMicPermission.mockResolvedValue(false);
    const { getByTestId } = render(<AllowMicrophone />);
    await act(async () => {
      fireEvent.press(getByTestId("allow"));
    });
    expect(mockMarkWelcomeSeen).not.toHaveBeenCalled();
    expect(mockDismissAll).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("asks for confirmation before skipping and finishes on confirm", () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <AllowMicrophone />,
    );
    expect(queryByTestId("toast")).toBeNull();
    fireEvent.press(getByTestId("skip"));
    expect(getByText("Skip Onboarding?")).toBeTruthy();
    fireEvent.press(getByTestId("toast-primary"));
    expect(mockMarkWelcomeSeen).toHaveBeenCalledTimes(1);
    expect(mockDismissAll).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(Routes.home);
    expect(queryByTestId("toast")).toBeNull();
  });

  it("cancelling the skip confirmation keeps the user on the screen", () => {
    const { getByTestId, queryByTestId } = render(<AllowMicrophone />);
    fireEvent.press(getByTestId("skip"));
    fireEvent.press(getByTestId("toast-secondary"));
    expect(queryByTestId("toast")).toBeNull();
    expect(mockMarkWelcomeSeen).not.toHaveBeenCalled();
    expect(mockDismissAll).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("replaces home without dismissing when this is the only screen", async () => {
    mockCanDismiss.mockReturnValue(false);
    mockEnsureMicPermission.mockResolvedValue(true);
    const { getByTestId } = render(<AllowMicrophone />);
    await act(async () => {
      fireEvent.press(getByTestId("allow"));
    });
    expect(mockDismissAll).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith(Routes.home);
  });
});
