/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";

import AdvancedSettingsScreen from "./advanced";

// --- Mocks ---

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock("@/theme", () => ({
  useTheme: jest.fn(() => ({
    theme: {
      colors: {
        surfaceBackground: "#fff",
        surfacePrimary: "#fff",
        surfaceBorderPrimary: "#ccc",
        textPrimary: "#000",
        textSecondary: "#666",
      },
    },
  })),
}));

const { mockMakeLoc } = require("../../../test-utils/mock-localization/mockLocalization");

jest.mock("@/hooks", () => ({
  useLocalization: jest.fn(() => ({ loc: mockMakeLoc() })),
}));

const mockSetSmartSplitEnabled = jest.fn();
jest.mock("@/stores", () => ({
  useSmartSplitEnabled: jest.fn(() => true),
  useSetSmartSplitEnabled: jest.fn(() => mockSetSmartSplitEnabled),
}));

jest.mock("@/components", () => {
  const { View, Text: RNText, TouchableOpacity } = require("react-native");
  const { TestID: TID, dynamicTestID: dTID } = require("@/constants");
  return {
    Card: ({ children }: any) => <View testID={TID.Card}>{children}</View>,
    ListItem: ({ title, subtitle, onPress, iconTrailing, testID }: any) => (
      <TouchableOpacity
        testID={testID ?? dTID.listItem(title)}
        onPress={onPress}
      >
        <RNText>{String(title)}</RNText>
        {subtitle && <RNText testID="subtitle">{String(subtitle)}</RNText>}
        {iconTrailing}
      </TouchableOpacity>
    ),
    Screen: ({ children }: any) => <View>{children}</View>,
    Text: ({ children }: any) => <RNText>{String(children)}</RNText>,
    Toggle: ({ value, onValueChange }: any) => (
      <TouchableOpacity testID="toggle" onPress={() => onValueChange?.(!value)}>
        <RNText testID="toggle-value">{value ? "on" : "off"}</RNText>
      </TouchableOpacity>
    ),
    TopAppBar: ({ title }: any) => (
      <View testID={TID.TopAppBar}>
        <RNText>{String(title)}</RNText>
      </View>
    ),
  };
});

describe("AdvancedSettingsScreen", () => {
  beforeEach(() => {
    mockSetSmartSplitEnabled.mockReset();
    mockSetSmartSplitEnabled.mockResolvedValue(undefined);
    const { useSmartSplitEnabled } = require("@/stores");
    (useSmartSplitEnabled as jest.Mock).mockReturnValue(true);
  });

  it("renders TopAppBar with advanced settings title", () => {
    const { getByTestId, getByText } = render(<AdvancedSettingsScreen />);
    expect(getByTestId(TestID.TopAppBar)).toBeTruthy();
    expect(getByText("advancedSettingsTitle")).toBeTruthy();
  });

  it("renders the toggle row and the description as a caption below the card", () => {
    const { getByTestId, getByText } = render(<AdvancedSettingsScreen />);
    expect(getByTestId(TestID.SettingsSmartSplitToggle)).toBeTruthy();
    expect(getByText("smartSplitTitle")).toBeTruthy();
    // Description moved out of the row to a caption below the Card so it
    // can wrap freely on narrow Android screens.
    expect(getByText("smartSplitDescription")).toBeTruthy();
  });

  it("toggle reflects the current enabled state (on by default)", () => {
    const { getByTestId } = render(<AdvancedSettingsScreen />);
    expect(getByTestId("toggle-value")).toHaveTextContent("on");
  });

  it("toggle reflects disabled state when store says off", () => {
    const { useSmartSplitEnabled } = require("@/stores");
    (useSmartSplitEnabled as jest.Mock).mockReturnValueOnce(false);

    const { getByTestId } = render(<AdvancedSettingsScreen />);
    expect(getByTestId("toggle-value")).toHaveTextContent("off");
  });

  it("pressing the toggle persists the flipped value", async () => {
    const { getByTestId } = render(<AdvancedSettingsScreen />);
    fireEvent.press(getByTestId("toggle"));
    await waitFor(() => {
      expect(mockSetSmartSplitEnabled).toHaveBeenCalledWith(false);
    });
  });

  it("pressing the row also flips the toggle", async () => {
    const { getByTestId } = render(<AdvancedSettingsScreen />);
    fireEvent.press(getByTestId(TestID.SettingsSmartSplitToggle));
    await waitFor(() => {
      expect(mockSetSmartSplitEnabled).toHaveBeenCalledWith(false);
    });
  });
});
