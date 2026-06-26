/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";

import MicrophoneTimeoutSettingsScreen from "./microphone-timeout";

// --- Mocks ---

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

const mockSetMicTimeout = jest.fn();
let mockSelected = 300;

jest.mock("@/theme", () => ({
  useTheme: jest.fn(() => ({
    theme: { colors: { surfaceBackground: "#fff" } },
  })),
}));

const {
  mockMakeLoc,
} = require("../../../src/test-utils/mock-localization/mockLocalization");

jest.mock("@/hooks", () => ({
  useLocalization: jest.fn(() => ({ loc: mockMakeLoc() })),
}));

jest.mock("@/stores", () => ({
  KEYBOARD_MIC_TIMEOUT_OPTIONS: [0, 60, 300, 1200, 3600],
  useKeyboardMicTimeout: jest.fn(() => mockSelected),
  useSetKeyboardMicTimeout: jest.fn(() => mockSetMicTimeout),
}));

jest.mock("@/utils", () => ({
  delay: jest.fn(() => Promise.resolve()),
  logError: jest.fn(),
  FeatureFlag: { settings: "settings" },
}));

jest.mock("@/components", () => {
  const { View, Text, TouchableOpacity } = require("react-native");
  const { TestID: TID, dynamicTestID: dTID } = require("@/constants");
  return {
    AppBarBlurTarget: ({ children }: any) => <View>{children}</View>,
    ListItem: ({ title, onPress, iconTrailing }: any) => (
      <TouchableOpacity testID={dTID.listItem(title)} onPress={onPress}>
        <Text>{String(title)}</Text>
        {iconTrailing}
      </TouchableOpacity>
    ),
    Radio: ({ value, groupValue, onValueChange }: any) => (
      <TouchableOpacity
        testID={dTID.radio(value)}
        onPress={() => onValueChange?.(value)}
      >
        <Text testID={dTID.radioSelected(value)}>
          {value === groupValue ? "selected" : "unselected"}
        </Text>
      </TouchableOpacity>
    ),
    Screen: ({ children }: any) => <View>{children}</View>,
    TopAppBar: ({ title }: any) => (
      <View testID={TID.TopAppBar}>
        <Text>{String(title)}</Text>
      </View>
    ),
  };
});

describe("MicrophoneTimeoutSettingsScreen", () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockSetMicTimeout.mockClear();
    mockSelected = 300;
  });

  it("renders TopAppBar with the timeout title", () => {
    const { getByTestId, getByText } = render(
      <MicrophoneTimeoutSettingsScreen />,
    );
    expect(getByTestId(TestID.TopAppBar)).toBeTruthy();
    expect(getByText("micTimeoutTitle")).toBeTruthy();
  });

  it("renders all five timeout options", () => {
    const { getByTestId } = render(<MicrophoneTimeoutSettingsScreen />);
    for (const seconds of [0, 60, 300, 1200, 3600]) {
      expect(getByTestId(`radio-${seconds}`)).toBeTruthy();
    }
  });

  it("marks the current selection (300) as selected", () => {
    const { getByTestId } = render(<MicrophoneTimeoutSettingsScreen />);
    expect(getByTestId("radio-selected-300")).toHaveTextContent("selected");
    expect(getByTestId("radio-selected-60")).toHaveTextContent("unselected");
  });

  it("selecting the current value navigates back without saving", () => {
    const { getByTestId } = render(<MicrophoneTimeoutSettingsScreen />);
    fireEvent.press(getByTestId("radio-300"));
    expect(mockBack).toHaveBeenCalled();
    expect(mockSetMicTimeout).not.toHaveBeenCalled();
  });

  it("selecting a different value saves it and navigates back", async () => {
    mockSetMicTimeout.mockResolvedValue(undefined);
    const { getByTestId } = render(<MicrophoneTimeoutSettingsScreen />);
    fireEvent.press(getByTestId("radio-1200"));
    await waitFor(() => {
      expect(mockSetMicTimeout).toHaveBeenCalledWith(1200);
      expect(mockBack).toHaveBeenCalled();
    });
  });

  it("can select Off (0)", async () => {
    mockSetMicTimeout.mockResolvedValue(undefined);
    const { getByTestId } = render(<MicrophoneTimeoutSettingsScreen />);
    fireEvent.press(getByTestId("radio-0"));
    await waitFor(() => {
      expect(mockSetMicTimeout).toHaveBeenCalledWith(0);
    });
  });

  it("logs an error when saving fails", async () => {
    const { logError } = require("@/utils");
    mockSetMicTimeout.mockRejectedValue(new Error("save error"));
    const { getByTestId } = render(<MicrophoneTimeoutSettingsScreen />);
    fireEvent.press(getByTestId("radio-3600"));
    await waitFor(() => {
      expect(logError).toHaveBeenCalled();
    });
  });

  it("ignores a second selection while saving", async () => {
    mockSetMicTimeout.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 5000)),
    );
    const { getByTestId } = render(<MicrophoneTimeoutSettingsScreen />);
    fireEvent.press(getByTestId("radio-60"));
    fireEvent.press(getByTestId("radio-1200"));
    await waitFor(() => {
      expect(mockSetMicTimeout).toHaveBeenCalledTimes(1);
      expect(mockSetMicTimeout).toHaveBeenCalledWith(60);
    });
  });

  it("shows the pending value as selected while saving", async () => {
    let resolveSet: () => void;
    mockSetMicTimeout.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSet = resolve;
        }),
    );
    const { getByTestId } = render(<MicrophoneTimeoutSettingsScreen />);
    fireEvent.press(getByTestId("radio-3600"));
    await waitFor(() => {
      expect(getByTestId("radio-selected-3600")).toHaveTextContent("selected");
    });
    resolveSet!();
    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled();
    });
  });
});
