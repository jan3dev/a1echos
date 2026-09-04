/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

import { Routes, TestID } from "@/constants";

import AdvancedSettingsScreen from "./advanced";

// --- Mocks ---

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
}));

jest.mock("@/utils", () => ({
  ...jest.requireActual("@/utils"),
  logError: jest.fn(),
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

const {
  mockMakeLoc,
} = require("../../../src/test-utils/mock-localization/mockLocalization");

jest.mock("@/hooks", () => ({
  useScrollSurface: jest.fn(() => ({
    scrolled: false,
    contentBelow: false,
    onScroll: jest.fn(),
    onContentSizeChange: jest.fn(),
    onLayout: jest.fn(),
  })),
  useLocalization: jest.fn(() => ({ loc: mockMakeLoc() })),
}));

const mockSetSmartSplitEnabled = jest.fn();
const mockSetKeyboardAutocorrect = jest.fn();
const mockSetKeyboardHaptic = jest.fn();
const mockSetKeyboardSound = jest.fn();
const mockShowKeyboardPrompt = jest.fn();
jest.mock("@/stores", () => ({
  useSmartSplitEnabled: jest.fn(() => true),
  useSetSmartSplitEnabled: jest.fn(() => mockSetSmartSplitEnabled),
  useKeyboardAutocorrect: jest.fn(() => false),
  useSetKeyboardAutocorrect: jest.fn(() => mockSetKeyboardAutocorrect),
  useKeyboardHaptic: jest.fn(() => false),
  useSetKeyboardHaptic: jest.fn(() => mockSetKeyboardHaptic),
  useKeyboardSound: jest.fn(() => false),
  useSetKeyboardSound: jest.fn(() => mockSetKeyboardSound),
  useKeyboardMicTimeout: jest.fn(() => 300),
  useShowKeyboardPrompt: jest.fn(() => mockShowKeyboardPrompt),
}));

jest.mock("@/components", () => {
  const { View, Text: RNText, TouchableOpacity } = require("react-native");
  const { TestID: TID, dynamicTestID: dTID } = require("@/constants");
  return {
    AppBarBlurTarget: ({ children }: any) => <View>{children}</View>,
    Card: ({ children }: any) => <View testID={TID.Card}>{children}</View>,
    Icon: ({ name }: any) => <View testID={dTID.icon(name)} />,
    ListItem: ({
      title,
      subtitle,
      contentWidget,
      titleTrailing,
      onPress,
      iconTrailing,
      testID,
    }: any) => (
      <TouchableOpacity
        testID={testID ?? dTID.listItem(title)}
        onPress={onPress}
        disabled={!onPress}
      >
        <RNText>{String(title)}</RNText>
        {subtitle && <RNText testID="subtitle">{String(subtitle)}</RNText>}
        {contentWidget}
        {titleTrailing && <RNText>{String(titleTrailing)}</RNText>}
        {iconTrailing}
      </TouchableOpacity>
    ),
    Screen: ({ children }: any) => <View>{children}</View>,
    Text: ({ children }: any) => <RNText>{String(children)}</RNText>,
    Toggle: ({ value, onValueChange, accessibilityLabel, enabled }: any) => (
      <TouchableOpacity
        testID={`toggle-${accessibilityLabel}`}
        onPress={() => onValueChange?.(!value)}
        disabled={enabled === false}
      >
        <RNText testID={`toggle-value-${accessibilityLabel}`}>
          {value ? "on" : "off"}
        </RNText>
        <RNText testID={`toggle-enabled-${accessibilityLabel}`}>
          {enabled === false ? "disabled" : "enabled"}
        </RNText>
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
    mockSetKeyboardAutocorrect.mockReset();
    mockSetKeyboardAutocorrect.mockResolvedValue(undefined);
    mockSetKeyboardHaptic.mockReset();
    mockSetKeyboardHaptic.mockResolvedValue(undefined);
    mockSetKeyboardSound.mockReset();
    mockSetKeyboardSound.mockResolvedValue(undefined);
    mockShowKeyboardPrompt.mockReset();
    mockPush.mockReset();
    const {
      useSmartSplitEnabled,
      useKeyboardAutocorrect,
      useKeyboardHaptic,
      useKeyboardSound,
      useKeyboardMicTimeout,
    } = require("@/stores");
    (useSmartSplitEnabled as jest.Mock).mockReturnValue(true);
    (useKeyboardAutocorrect as jest.Mock).mockReturnValue(false);
    (useKeyboardHaptic as jest.Mock).mockReturnValue(false);
    (useKeyboardSound as jest.Mock).mockReturnValue(false);
    (useKeyboardMicTimeout as jest.Mock).mockReturnValue(300);
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
    expect(getByTestId("toggle-value-smartSplitTitle")).toHaveTextContent("on");
  });

  it("toggle reflects disabled state when store says off", () => {
    const { useSmartSplitEnabled } = require("@/stores");
    (useSmartSplitEnabled as jest.Mock).mockReturnValueOnce(false);

    const { getByTestId } = render(<AdvancedSettingsScreen />);
    expect(getByTestId("toggle-value-smartSplitTitle")).toHaveTextContent(
      "off",
    );
  });

  it("pressing the toggle persists the flipped value", async () => {
    const { getByTestId } = render(<AdvancedSettingsScreen />);
    fireEvent.press(getByTestId("toggle-smartSplitTitle"));
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

  it("renders the Add Echos Keyboard row with description caption", () => {
    const { getByTestId, getByText } = render(<AdvancedSettingsScreen />);
    expect(getByTestId(TestID.SettingsAddKeyboardRow)).toBeTruthy();
    expect(getByText("advancedSettingsAddKeyboardTitle")).toBeTruthy();
    expect(getByText("advancedSettingsAddKeyboardDescription")).toBeTruthy();
  });

  it("pressing Add Echos Keyboard row opens the prompt", () => {
    const { getByTestId } = render(<AdvancedSettingsScreen />);
    fireEvent.press(getByTestId(TestID.SettingsAddKeyboardRow));
    expect(mockShowKeyboardPrompt).toHaveBeenCalledTimes(1);
  });

  it("renders the keyboard autocorrect row (off by default)", () => {
    const { getByTestId, getByText } = render(<AdvancedSettingsScreen />);
    expect(getByTestId(TestID.SettingsKeyboardAutocorrectToggle)).toBeTruthy();
    expect(getByText("keyboardAutocorrectTitle")).toBeTruthy();
    expect(getByText("keyboardAutocorrectDescription")).toBeTruthy();
    expect(
      getByTestId("toggle-value-keyboardAutocorrectTitle"),
    ).toHaveTextContent("off");
  });

  it("pressing the autocorrect toggle persists the flipped value", async () => {
    const { getByTestId } = render(<AdvancedSettingsScreen />);
    fireEvent.press(getByTestId("toggle-keyboardAutocorrectTitle"));
    await waitFor(() => {
      expect(mockSetKeyboardAutocorrect).toHaveBeenCalledWith(true);
    });
  });

  it("pressing the autocorrect row also flips the toggle", async () => {
    const { getByTestId } = render(<AdvancedSettingsScreen />);
    fireEvent.press(getByTestId(TestID.SettingsKeyboardAutocorrectToggle));
    await waitFor(() => {
      expect(mockSetKeyboardAutocorrect).toHaveBeenCalledWith(true);
    });
  });

  it("renders the keyboard haptic row (off by default)", () => {
    const { getByTestId, getByText } = render(<AdvancedSettingsScreen />);
    expect(getByTestId(TestID.SettingsKeyboardHapticToggle)).toBeTruthy();
    expect(getByText("keyboardHapticTitle")).toBeTruthy();
    expect(getByText("keyboardHapticDescription")).toBeTruthy();
    expect(getByTestId("toggle-value-keyboardHapticTitle")).toHaveTextContent(
      "off",
    );
  });

  it("pressing the haptic toggle persists the flipped value", async () => {
    const { getByTestId } = render(<AdvancedSettingsScreen />);
    fireEvent.press(getByTestId("toggle-keyboardHapticTitle"));
    await waitFor(() => {
      expect(mockSetKeyboardHaptic).toHaveBeenCalledWith(true);
    });
  });

  it("pressing the haptic row also flips the toggle", async () => {
    const { getByTestId } = render(<AdvancedSettingsScreen />);
    fireEvent.press(getByTestId(TestID.SettingsKeyboardHapticToggle));
    await waitFor(() => {
      expect(mockSetKeyboardHaptic).toHaveBeenCalledWith(true);
    });
  });

  it("renders the keyboard sound row", () => {
    const { getByTestId, getByText } = render(<AdvancedSettingsScreen />);
    expect(getByTestId(TestID.SettingsKeyboardSoundToggle)).toBeTruthy();
    expect(getByText("keyboardSoundTitle")).toBeTruthy();
    expect(getByText("keyboardSoundDescription")).toBeTruthy();
    expect(getByTestId("toggle-value-keyboardSoundTitle")).toHaveTextContent(
      "off",
    );
  });

  it("pressing the sound toggle persists the flipped value", async () => {
    const { getByTestId } = render(<AdvancedSettingsScreen />);
    fireEvent.press(getByTestId("toggle-keyboardSoundTitle"));
    await waitFor(() => {
      expect(mockSetKeyboardSound).toHaveBeenCalledWith(true);
    });
  });

  it("pressing the sound row also flips the toggle", async () => {
    const { getByTestId } = render(<AdvancedSettingsScreen />);
    fireEvent.press(getByTestId(TestID.SettingsKeyboardSoundToggle));
    await waitFor(() => {
      expect(mockSetKeyboardSound).toHaveBeenCalledWith(true);
    });
  });

  it("renders the microphone-timeout row with the current value", () => {
    const { getByTestId, getByText } = render(<AdvancedSettingsScreen />);
    expect(getByTestId(TestID.SettingsMicTimeoutRow)).toBeTruthy();
    expect(getByText("micTimeoutTitle")).toBeTruthy();
    // Default 300s → the "5 minutes" label.
    expect(getByText("micTimeout5Min")).toBeTruthy();
  });

  it.each([
    [0, "micTimeoutOff"],
    [60, "micTimeout1Min"],
    [1200, "micTimeout20Min"],
    [3600, "micTimeout60Min"],
  ])("shows the right label for a %i second timeout", (seconds, label) => {
    const { useKeyboardMicTimeout } = require("@/stores");
    (useKeyboardMicTimeout as jest.Mock).mockReturnValueOnce(seconds);
    const { getByText } = render(<AdvancedSettingsScreen />);
    expect(getByText(label)).toBeTruthy();
  });

  it("pressing the microphone-timeout row navigates to the picker", () => {
    const { getByTestId } = render(<AdvancedSettingsScreen />);
    fireEvent.press(getByTestId(TestID.SettingsMicTimeoutRow));
    expect(mockPush).toHaveBeenCalledWith(Routes.settingsMicTimeout);
  });

  it("hides the microphone-timeout row on Android", () => {
    const { Platform } = require("react-native");
    const originalOS = Platform.OS;
    Platform.OS = "android";
    try {
      const { queryByTestId } = render(<AdvancedSettingsScreen />);
      expect(queryByTestId(TestID.SettingsMicTimeoutRow)).toBeNull();
    } finally {
      Platform.OS = originalOS;
    }
  });
});
