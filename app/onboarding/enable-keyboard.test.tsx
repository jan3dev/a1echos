/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { AppState, AppStateStatus } from "react-native";

import { Routes } from "@/constants";

import EnableKeyboard from "./enable-keyboard";

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockRouter = { push: mockPush, back: mockBack };
let mockParams: { resumed?: string } = {};
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));

const mockOpenKeyboardSettings = jest.fn();
const mockReadKeyboardEnabled = jest.fn();
jest.mock("@/utils", () => ({
  openKeyboardSettings: () => mockOpenKeyboardSettings(),
  readKeyboardEnabled: () => mockReadKeyboardEnabled(),
}));

const mockConfirmSkip = jest.fn();
const mockLoc = {
  onboardingKeyboardNotAddedTitle: "Not Added",
  onboardingKeyboardNotAddedMessage: "Add it",
};
jest.mock("@/hooks", () => ({
  useLocalization: () => ({ loc: mockLoc }),
  useOnboardingExit: () => ({
    finishOnboarding: jest.fn(),
    confirmSkip: mockConfirmSkip,
  }),
}));

const mockShow = jest.fn();
jest.mock("@/components/ui/toast/useToast", () => ({
  useToast: () => ({ show: mockShow, toastState: {} }),
}));

let appStateListener: (state: AppStateStatus) => void;
jest.spyOn(AppState, "addEventListener").mockImplementation((_, listener) => {
  appStateListener = listener;
  return { remove: jest.fn() };
});

const returnFromSettings = async () => {
  await act(async () => {
    appStateListener("background");
    appStateListener("active");
  });
};

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
  mockParams = {};
  mockOpenKeyboardSettings.mockResolvedValue(true);
  mockReadKeyboardEnabled.mockResolvedValue(true);
});

describe("EnableKeyboard route", () => {
  it("wires back and skip", () => {
    const { getByTestId } = render(<EnableKeyboard />);
    fireEvent.press(getByTestId("back"));
    fireEvent.press(getByTestId("skip"));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockConfirmSkip).toHaveBeenCalledTimes(1);
  });

  it("continues to the language step on return when the keyboard is added", async () => {
    const { getByTestId } = render(<EnableKeyboard />);
    await act(async () => {
      fireEvent.press(getByTestId("settings"));
    });
    expect(mockOpenKeyboardSettings).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
    await returnFromSettings();
    expect(mockPush).toHaveBeenCalledWith(Routes.onboardingSpokenLanguage);
  });

  it("continues when the keyboard status is unknown", async () => {
    mockReadKeyboardEnabled.mockResolvedValue(null);
    const { getByTestId } = render(<EnableKeyboard />);
    await act(async () => {
      fireEvent.press(getByTestId("settings"));
    });
    await returnFromSettings();
    expect(mockPush).toHaveBeenCalledWith(Routes.onboardingSpokenLanguage);
  });

  it("stays and warns on return when the keyboard isn't added", async () => {
    mockReadKeyboardEnabled.mockResolvedValue(false);
    const { getByTestId } = render(<EnableKeyboard />);
    await act(async () => {
      fireEvent.press(getByTestId("settings"));
    });
    await returnFromSettings();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockShow).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Not Added", variant: "warning" }),
    );
  });

  it("ignores foregrounding without a Settings visit", async () => {
    render(<EnableKeyboard />);
    await returnFromSettings();
    expect(mockReadKeyboardEnabled).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("continues straight away when resumed with the keyboard added", async () => {
    mockParams = { resumed: "1" };
    render(<EnableKeyboard />);
    await act(async () => {});
    expect(mockPush).toHaveBeenCalledWith(Routes.onboardingSpokenLanguage);
  });

  it("stays silently when resumed without the keyboard added", async () => {
    mockParams = { resumed: "1" };
    mockReadKeyboardEnabled.mockResolvedValue(false);
    render(<EnableKeyboard />);
    await act(async () => {});
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockShow).not.toHaveBeenCalled();
  });

  it("stays on the screen when keyboard settings fail to open", async () => {
    mockOpenKeyboardSettings.mockResolvedValue(false);
    const { getByTestId } = render(<EnableKeyboard />);
    await act(async () => {
      fireEvent.press(getByTestId("settings"));
    });
    await returnFromSettings();
    expect(mockReadKeyboardEnabled).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
