/* eslint-disable @typescript-eslint/no-require-imports */
import {
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react-native";
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

const mockEnsureModelDownloaded = jest.fn(() => Promise.resolve(true));
jest.mock("@/hooks", () => ({
  useEnsureModelDownloaded: jest.fn(() => mockEnsureModelDownloaded),
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
const mockSetContextAwareAutocorrect = jest.fn();
const mockUseKeyboardContextAwareAutocorrect = jest.fn(() => false);
const mockUseIsModelDownloaded = jest.fn(() => false);
const mockUseModelDownloadProgress = jest.fn(() => undefined as any);
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
  useKeyboardContextAwareAutocorrect: () =>
    mockUseKeyboardContextAwareAutocorrect(),
  useSetKeyboardContextAwareAutocorrect: jest.fn(
    () => mockSetContextAwareAutocorrect,
  ),
  useKeyboardLmStrength: jest.fn(() => 1.0),
  useIsModelDownloaded: () => mockUseIsModelDownloaded(),
  useModelDownloadProgress: () => mockUseModelDownloadProgress(),
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
    DownloadProgressBar: ({ ratio }: any) => (
      <View testID={`progress-bar-${Math.round(ratio * 100)}`} />
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
    mockEnsureModelDownloaded.mockClear();
    mockEnsureModelDownloaded.mockResolvedValue(true);
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
    mockSetContextAwareAutocorrect.mockReset();
    mockSetContextAwareAutocorrect.mockResolvedValue(undefined);
    mockUseKeyboardContextAwareAutocorrect.mockReset();
    mockUseKeyboardContextAwareAutocorrect.mockReturnValue(false);
    mockUseIsModelDownloaded.mockReset();
    mockUseIsModelDownloaded.mockReturnValue(false);
    mockUseModelDownloadProgress.mockReset();
    mockUseModelDownloadProgress.mockReturnValue(undefined);
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

  it("enabling context-aware autocorrect downloads the model, then flips the setting", async () => {
    mockUseKeyboardContextAwareAutocorrect.mockReturnValue(false);
    mockUseIsModelDownloaded.mockReturnValue(false);
    const { getByTestId } = render(<AdvancedSettingsScreen />);
    fireEvent.press(getByTestId(TestID.SettingsContextAwareAutocorrectToggle));
    await waitFor(() => {
      expect(mockEnsureModelDownloaded).toHaveBeenCalledWith("keyboard_lm");
      expect(mockSetContextAwareAutocorrect).toHaveBeenCalledWith(true);
    });
  });

  // The keyboard gates the LM on the file existing, so a setting left on after
  // a failed or cancelled download would read as enabled and do nothing.
  it.each([
    ["a failed download", false],
    ["a cancelled download", false],
  ])("leaves the setting off after %s", async (_label, result) => {
    mockUseKeyboardContextAwareAutocorrect.mockReturnValue(false);
    mockUseIsModelDownloaded.mockReturnValue(false);
    mockEnsureModelDownloaded.mockResolvedValue(result);
    const { getByTestId } = render(<AdvancedSettingsScreen />);
    fireEvent.press(getByTestId(TestID.SettingsContextAwareAutocorrectToggle));
    await waitFor(() => {
      expect(mockEnsureModelDownloaded).toHaveBeenCalledWith("keyboard_lm");
    });
    expect(mockSetContextAwareAutocorrect).not.toHaveBeenCalled();
  });

  it("shows a progress bar and locks the toggle while the model downloads", () => {
    mockUseKeyboardContextAwareAutocorrect.mockReturnValue(false);
    mockUseIsModelDownloaded.mockReturnValue(false);
    mockUseModelDownloadProgress.mockReturnValue({
      status: "downloading",
      progressRatio: 0.42,
    });
    const { getByTestId } = render(<AdvancedSettingsScreen />);

    expect(getByTestId("progress-bar-42")).toBeTruthy();
    expect(
      getByTestId("toggle-enabled-contextAwareAutocorrectTitle"),
    ).toHaveTextContent("disabled");
    expect(
      getByTestId("toggle-value-contextAwareAutocorrectTitle"),
    ).toHaveTextContent("off");
    // The description gives way to the progress readout rather than stacking.
    // Scoped to this row — every row's subtitle shares one testID.
    const row = within(
      getByTestId(TestID.SettingsContextAwareAutocorrectToggle),
    );
    expect(row.queryByTestId("subtitle")).toBeNull();
  });

  // "checking" is the pre-flight beat before the first byte lands; the row must
  // not flicker back to its idle state for it.
  it("treats a checking status as downloading", () => {
    mockUseModelDownloadProgress.mockReturnValue({
      status: "checking",
      progressRatio: 0,
    });
    const { getByTestId } = render(<AdvancedSettingsScreen />);
    expect(getByTestId("progress-bar-0")).toBeTruthy();
    expect(
      getByTestId("toggle-enabled-contextAwareAutocorrectTitle"),
    ).toHaveTextContent("disabled");
  });

  // The row press and the switch itself are separate entry points; only the
  // row one was covered before.
  it("flipping the switch itself enables the setting", async () => {
    mockUseKeyboardContextAwareAutocorrect.mockReturnValue(false);
    mockUseIsModelDownloaded.mockReturnValue(true);
    const { getByTestId } = render(<AdvancedSettingsScreen />);
    fireEvent.press(getByTestId("toggle-contextAwareAutocorrectTitle"));
    await waitFor(() => {
      expect(mockSetContextAwareAutocorrect).toHaveBeenCalledWith(true);
    });
  });

  it("logs instead of throwing when persisting the setting fails", async () => {
    const { logError } = require("@/utils");
    mockUseIsModelDownloaded.mockReturnValue(true);
    mockSetContextAwareAutocorrect.mockRejectedValue(new Error("disk full"));
    const { getByTestId } = render(<AdvancedSettingsScreen />);
    fireEvent.press(getByTestId(TestID.SettingsContextAwareAutocorrectToggle));
    await waitFor(() => {
      expect(logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          message: "Failed to set context-aware autocorrect",
        }),
      );
    });
  });

  it("pressing the row does nothing while the model downloads", () => {
    mockUseModelDownloadProgress.mockReturnValue({
      status: "downloading",
      progressRatio: 0.1,
    });
    const { getByTestId } = render(<AdvancedSettingsScreen />);
    fireEvent.press(getByTestId(TestID.SettingsContextAwareAutocorrectToggle));
    expect(mockEnsureModelDownloaded).not.toHaveBeenCalled();
    expect(mockSetContextAwareAutocorrect).not.toHaveBeenCalled();
  });

  it("mentions the download size only until the model is on disk", () => {
    mockUseIsModelDownloaded.mockReturnValue(false);
    const missing = render(<AdvancedSettingsScreen />);
    expect(
      missing.getByText(/contextAwareAutocorrectDownloadHint/),
    ).toBeTruthy();
    missing.unmount();

    mockUseIsModelDownloaded.mockReturnValue(true);
    const present = render(<AdvancedSettingsScreen />);
    expect(
      present.queryByText(/contextAwareAutocorrectDownloadHint/),
    ).toBeNull();
  });

  it("enabling with the model already downloaded skips the download", async () => {
    mockUseKeyboardContextAwareAutocorrect.mockReturnValue(false);
    mockUseIsModelDownloaded.mockReturnValue(true);
    const { getByTestId } = render(<AdvancedSettingsScreen />);
    fireEvent.press(getByTestId(TestID.SettingsContextAwareAutocorrectToggle));
    await waitFor(() => {
      expect(mockSetContextAwareAutocorrect).toHaveBeenCalledWith(true);
    });
    expect(mockEnsureModelDownloaded).not.toHaveBeenCalled();
  });

  it("disabling context-aware autocorrect never downloads", async () => {
    mockUseKeyboardContextAwareAutocorrect.mockReturnValue(true);
    mockUseIsModelDownloaded.mockReturnValue(false);
    const { getByTestId } = render(<AdvancedSettingsScreen />);
    fireEvent.press(getByTestId(TestID.SettingsContextAwareAutocorrectToggle));
    await waitFor(() => {
      expect(mockSetContextAwareAutocorrect).toHaveBeenCalledWith(false);
    });
    expect(mockEnsureModelDownloaded).not.toHaveBeenCalled();
  });

  it("shows the strength row only while the toggle is on, and it navigates", () => {
    mockUseKeyboardContextAwareAutocorrect.mockReturnValue(false);
    const off = render(<AdvancedSettingsScreen />);
    expect(off.queryByTestId(TestID.SettingsLmStrengthRow)).toBeNull();
    off.unmount();

    mockUseKeyboardContextAwareAutocorrect.mockReturnValue(true);
    const on = render(<AdvancedSettingsScreen />);
    fireEvent.press(on.getByTestId(TestID.SettingsLmStrengthRow));
    expect(mockPush).toHaveBeenCalledTimes(1);
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
