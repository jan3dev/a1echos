/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

import { dynamicTestID, Routes, TestID } from "@/constants";

import AdvancedSettingsScreen from "./advanced";

// --- Mocks ---

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
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
        accentSuccess: "#18A23B",
      },
    },
  })),
}));

const {
  mockMakeLoc,
} = require("../../../src/test-utils/mock-localization/mockLocalization");

const mockReadKeyboardEnabled = jest.fn();
jest.mock("@/utils", () => ({
  readKeyboardEnabled: () => mockReadKeyboardEnabled(),
}));

const mockAppStateListeners: ((state: string) => void)[] = [];
jest
  .spyOn(require("react-native").AppState, "addEventListener")
  .mockImplementation((_: any, listener: any) => {
    mockAppStateListeners.push(listener);
    return { remove: jest.fn() };
  });

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
  useSelectedLanguage: jest.fn(() => ({ code: "en", name: "English" })),
}));

jest.mock("@/components", () => {
  const { View, Text: RNText, TouchableOpacity } = require("react-native");
  const { TestID: TID, dynamicTestID: dTID } = require("@/constants");
  return {
    AppBarBlurTarget: ({ children }: any) => <View>{children}</View>,
    Icon: ({ name }: any) => <View testID={dTID.icon(name)} />,
    InfoSheet: ({ visible, title, message, onDismiss }: any) =>
      visible ? (
        <View testID={TID.InfoSheet}>
          <RNText>{`sheet:${title}`}</RNText>
          <RNText>{String(message)}</RNText>
          <TouchableOpacity testID={TID.InfoSheetClose} onPress={onDismiss} />
        </View>
      ) : null,
    ListItemGroup: ({ children }: any) => <View>{children}</View>,
    ListItem: ({
      title,
      subtitle,
      titleTrailing,
      onPress,
      iconTrailing,
      info,
      testID,
    }: any) => (
      <TouchableOpacity
        testID={testID ?? dTID.listItem(title)}
        onPress={onPress}
        disabled={!onPress}
      >
        <RNText>{String(title)}</RNText>
        {info && (
          <TouchableOpacity
            testID={dTID.listItemInfo(testID)}
            accessibilityLabel={String(info.accessibilityLabel)}
            onPress={info.onPress}
          />
        )}
        {subtitle && <RNText testID="subtitle">{String(subtitle)}</RNText>}
        {titleTrailing && <RNText>{String(titleTrailing)}</RNText>}
        {iconTrailing}
      </TouchableOpacity>
    ),
    Screen: ({ children }: any) => <View>{children}</View>,
    Text: ({ children }: any) => <RNText>{String(children)}</RNText>,
    Toggle: ({ value, onValueChange, accessibilityLabel }: any) => (
      <TouchableOpacity
        testID={`toggle-${accessibilityLabel}`}
        onPress={() => onValueChange?.(!value)}
      >
        <RNText testID={`toggle-value-${accessibilityLabel}`}>
          {value ? "on" : "off"}
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
    mockReadKeyboardEnabled.mockReset();
    mockReadKeyboardEnabled.mockResolvedValue(null);
    mockAppStateListeners.length = 0;
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

  it("renders the smart split row with its description behind an info icon", () => {
    const { getByTestId, getByText, queryByText } = render(
      <AdvancedSettingsScreen />,
    );
    expect(getByTestId(TestID.SettingsSmartSplitToggle)).toBeTruthy();
    expect(getByText("smartSplitTitle")).toBeTruthy();
    expect(queryByText("smartSplitDescription")).toBeNull();
  });

  it.each([
    [
      TestID.SettingsSmartSplitToggle,
      "smartSplitTitle",
      "smartSplitDescription",
    ],
    [
      TestID.SettingsKeyboardAutocorrectToggle,
      "keyboardAutocorrectTitle",
      "keyboardAutocorrectDescription",
    ],
    [TestID.SettingsMicTimeoutRow, "micTimeoutTitle", "micTimeoutDescription"],
    [
      TestID.SettingsAddKeyboardRow,
      "advancedSettingsKeyboardTitle",
      "advancedSettingsKeyboardDescription",
    ],
  ])(
    "the %s info icon opens a sheet with its caption",
    async (rowID, title, caption) => {
      const { getByTestId, getByText, queryByTestId } = render(
        <AdvancedSettingsScreen />,
      );
      await act(async () => {});
      expect(queryByTestId(TestID.InfoSheet)).toBeNull();
      fireEvent.press(getByTestId(dynamicTestID.listItemInfo(rowID)));
      expect(getByText(`sheet:${title}`)).toBeTruthy();
      expect(getByText(caption)).toBeTruthy();
      expect(mockPush).not.toHaveBeenCalled();

      fireEvent.press(getByTestId(TestID.InfoSheetClose));
      expect(queryByTestId(TestID.InfoSheet)).toBeNull();
    },
  );

  it("haptics and sounds rows have no info icon", () => {
    const { queryByTestId } = render(<AdvancedSettingsScreen />);
    for (const id of [
      TestID.SettingsKeyboardHapticToggle,
      TestID.SettingsKeyboardSoundToggle,
    ]) {
      expect(queryByTestId(dynamicTestID.listItemInfo(id))).toBeNull();
    }
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

  it("renders the Echos Keyboard row", () => {
    const { getByTestId, getByText } = render(<AdvancedSettingsScreen />);
    expect(getByTestId(TestID.SettingsAddKeyboardRow)).toBeTruthy();
    expect(getByText("advancedSettingsKeyboardTitle")).toBeTruthy();
  });

  it("shows Added when the keyboard is enabled", async () => {
    mockReadKeyboardEnabled.mockResolvedValue(true);
    const { findByText } = render(<AdvancedSettingsScreen />);
    expect(await findByText("advancedSettingsKeyboardAdded")).toBeTruthy();
  });

  it("shows no status when it is unknown", async () => {
    const { queryByText } = render(<AdvancedSettingsScreen />);
    await waitFor(() => expect(mockReadKeyboardEnabled).toHaveBeenCalled());
    expect(queryByText("advancedSettingsKeyboardAdded")).toBeNull();
    expect(queryByText("advancedSettingsKeyboardNotAdded")).toBeNull();
  });

  it("refreshes the status when returning to the foreground", async () => {
    mockReadKeyboardEnabled.mockResolvedValue(false);
    const { findByText } = render(<AdvancedSettingsScreen />);
    expect(await findByText("advancedSettingsKeyboardNotAdded")).toBeTruthy();

    mockReadKeyboardEnabled.mockResolvedValue(true);
    act(() => {
      mockAppStateListeners.forEach((l) => l("background"));
      mockAppStateListeners.forEach((l) => l("active"));
    });
    expect(await findByText("advancedSettingsKeyboardAdded")).toBeTruthy();
  });

  it("pressing Add Echos Keyboard row opens the Echos Keyboard screen", () => {
    const { getByTestId } = render(<AdvancedSettingsScreen />);
    fireEvent.press(getByTestId(TestID.SettingsAddKeyboardRow));
    expect(mockPush).toHaveBeenCalledWith(Routes.settingsEchosKeyboard);
  });

  it("renders the keyboard autocorrect row (off by default)", () => {
    const { getByTestId, getByText } = render(<AdvancedSettingsScreen />);
    expect(getByTestId(TestID.SettingsKeyboardAutocorrectToggle)).toBeTruthy();
    expect(getByText("keyboardAutocorrectTitle")).toBeTruthy();
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
    // Default 300s → the short "5 min" label.
    expect(getByText("micTimeout5MinShort")).toBeTruthy();
  });

  it.each([
    [0, "micTimeoutOff"],
    [60, "micTimeout1MinShort"],
    [1200, "micTimeout20MinShort"],
    [3600, "micTimeout60MinShort"],
  ])("shows the right label for a %i second timeout", (seconds, label) => {
    const { useKeyboardMicTimeout } = require("@/stores");
    (useKeyboardMicTimeout as jest.Mock).mockReturnValueOnce(seconds);
    const { getByText } = render(<AdvancedSettingsScreen />);
    expect(getByText(label)).toBeTruthy();
  });

  it("renders the spoken language row and navigates to the picker", () => {
    const { getByTestId, getAllByText } = render(<AdvancedSettingsScreen />);
    expect(getAllByText("EN")).toHaveLength(1);
    fireEvent.press(getByTestId(TestID.SettingsLanguage));
    expect(mockPush).toHaveBeenCalledWith(Routes.settingsLanguage);
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
