/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Platform } from "react-native";

import SwitchKeyboard from "./switch-keyboard";

const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
}));

const mockConfirmSkip = jest.fn();
jest.mock("@/hooks", () => ({
  useOnboardingExit: () => ({ confirmSkip: mockConfirmSkip }),
}));

const mockReadShownAt = jest.fn();
const mockShowPicker = jest.fn();
const mockReadSelected = jest.fn();
jest.mock("@/utils", () => ({
  readKeyboardShownAt: () => mockReadShownAt(),
  readKeyboardSelected: () => mockReadSelected(),
  showKeyboardPicker: () => mockShowPicker(),
}));

jest.mock("@/components", () => {
  const { TouchableOpacity, View } = require("react-native");
  return {
    SwitchKeyboardScreen: (props: {
      onBack: () => void;
      onSkip: () => void;
      onChooseKeyboard: () => void;
    }) => (
      <View>
        <TouchableOpacity testID="back" onPress={props.onBack} />
        <TouchableOpacity testID="skip" onPress={props.onSkip} />
        <TouchableOpacity testID="choose" onPress={props.onChooseKeyboard} />
      </View>
    ),
    Toast: () => null,
  };
});

const tick = () =>
  act(async () => {
    jest.advanceTimersByTime(500);
  });

describe("SwitchKeyboard onboarding route", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: 1000 });
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  it("wires back, skip and the keyboard picker", () => {
    mockReadShownAt.mockResolvedValue(null);
    const { getByTestId } = render(<SwitchKeyboard />);
    fireEvent.press(getByTestId("back"));
    fireEvent.press(getByTestId("skip"));
    fireEvent.press(getByTestId("choose"));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockConfirmSkip).toHaveBeenCalledTimes(1);
    expect(mockShowPicker).toHaveBeenCalledTimes(1);
  });

  it("advances once the keyboard appears after mount, and only once", async () => {
    mockReadShownAt.mockResolvedValue(999);
    render(<SwitchKeyboard />);
    await tick();
    expect(mockReplace).not.toHaveBeenCalled();

    mockReadShownAt.mockResolvedValue(1200);
    await tick();
    await tick();
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/onboarding/dictate");
  });

  it("on Android, advances once the system reports Echos selected", async () => {
    const originalOS = Platform.OS;
    Platform.OS = "android";
    try {
      mockReadSelected.mockReturnValue(false);
      render(<SwitchKeyboard />);
      await tick();
      expect(mockReplace).not.toHaveBeenCalled();

      mockReadSelected.mockReturnValue(true);
      await tick();
      await tick();
      expect(mockReplace).toHaveBeenCalledTimes(1);
      expect(mockReadShownAt).not.toHaveBeenCalled();
    } finally {
      Platform.OS = originalOS;
    }
  });

  it("stops polling on unmount", async () => {
    mockReadShownAt.mockResolvedValue(null);
    const { unmount } = render(<SwitchKeyboard />);
    unmount();
    await tick();
    expect(mockReadShownAt).not.toHaveBeenCalled();
  });

  it("ignores a read that resolves after unmount", async () => {
    let resolveRead: (v: number) => void = () => undefined;
    mockReadShownAt.mockReturnValue(
      new Promise<number>((r) => (resolveRead = r)),
    );
    const { unmount } = render(<SwitchKeyboard />);
    await tick();
    unmount();
    await act(async () => resolveRead(2000));
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
