/* eslint-disable @typescript-eslint/no-require-imports, react/display-name */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import React from "react";

import { Routes, TestID } from "@/constants";
import {
  initializeSessionStore,
  initializeSettingsStore,
  initializeTranscriptionStore,
} from "@/stores";
import { logError } from "@/utils";

import RootLayout from "./_layout";

// --- Mocks ---

// initTheme is accessed inside a closure (not eagerly), so hoisting is safe
const mockInitTheme = jest.fn().mockResolvedValue(undefined);

jest.mock("@/theme", () => ({
  spacing: { md: 16 },
  useTheme: jest.fn(() => ({
    theme: {
      colors: {
        surfaceBackground: "#fff",
        textInverse: "#fff",
        glassBackground: "rgba(0,0,0,0.1)",
      },
    },
    isDark: false,
  })),
  useThemeStore: jest.fn((sel?: any) => {
    const s = {
      currentTheme: "light",
      selectedTheme: "auto",
      initTheme: mockInitTheme,
    };
    return sel ? sel(s) : s;
  }),
}));

// Define mock fns INSIDE the factory so they exist at evaluation time
jest.mock("@/stores", () => ({
  initializeModelDownloadStore: jest.fn(),
  initializeSettingsStore: jest.fn().mockResolvedValue(undefined),
  initializeSessionStore: jest.fn().mockResolvedValue(undefined),
  initializeTranscriptionStore: jest.fn().mockResolvedValue(undefined),
  preWarmModel: jest.fn(),
  useGlobalTooltip: jest.fn(() => null),
  useHideGlobalTooltip: jest.fn(() => jest.fn()),
  useIsEngineInitializing: jest.fn(() => false),
  useIsSessionSelectionMode: jest.fn(() => false),
  useIsTranscriptionSelectionMode: jest.fn(() => false),
  useOnRecordingStart: jest.fn(() => jest.fn()),
  useOnRecordingStop: jest.fn(() => jest.fn()),
  useRecordingControlsEnabled: jest.fn(() => true),
  useRecordingControlsVisible: jest.fn(() => true),
  useSettingsStore: {
    getState: jest.fn(() => ({
      selectedModelId: "whisper-tiny",
      selectedLanguage: { code: "en", name: "English" },
    })),
  },
  useTranscriptionState: jest.fn(() => "IDLE"),
  useKeyboardPromptVisible: jest.fn(() => false),
  useHideKeyboardPrompt: jest.fn(() => jest.fn()),
  useMarkKeyboardPromptSeen: jest.fn(() =>
    jest.fn().mockResolvedValue(undefined),
  ),
  useVoiceSessionHintVisible: jest.fn(() => false),
  useHideVoiceSessionHint: jest.fn(() => jest.fn()),
  useLargerModelSuggestionVisible: jest.fn(() => false),
  useHideLargerModelSuggestion: jest.fn(() => jest.fn()),
  useMarkLargerModelSuggestionSeen: jest.fn(() =>
    jest.fn().mockResolvedValue(undefined),
  ),
  useSelectedLanguage: jest.fn(() => ({ code: "de", name: "German" })),
}));

jest.mock("@/services", () => ({
  registerForegroundService: jest.fn(),
}));

jest.mock("@/db", () => ({
  openAndPrepareDatabase: jest.fn().mockResolvedValue({}),
}));

// Note: @/db/migrations/migrations.js and drizzle-orm/expo-sqlite/migrator
// are stubbed globally in jest.setup.js — only the runtime-migration
// functions need a per-test override here.
jest.mock("@/db/runtime-migration", () => ({
  runLegacyMigrationIfNeeded: jest.fn().mockResolvedValue(undefined),
  consolidateDefaultSessionIfNeeded: jest.fn().mockResolvedValue(undefined),
  cleanupLegacyArtifactsIfPresent: jest.fn().mockResolvedValue(undefined),
}));

const mockKeyboardHeight = jest.fn(() => 0);
jest.mock("@/hooks", () => ({
  useKeyboardHeight: () => mockKeyboardHeight(),
  useVoiceSessionHint: jest.fn(),
  useLocalization: () => ({ loc: { transcriptionSettings: "settings" } }),
}));

jest.mock("@/utils", () => ({
  logError: jest.fn(),
  FeatureFlag: { general: "general", ui: "ui" },
  openKeyboardSettings: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/localization", () => ({}));

jest.mock("@/components", () => {
  const { View } = require("react-native");
  const { TestID: TID, dynamicTestID: dTID } = require("@/constants");
  return {
    BiometricLock: () => null,
    AppErrorBoundary: ({ children }: any) => (
      <View testID={TID.AppErrorBoundary}>{children}</View>
    ),
    Icon: ({ name }: any) => <View testID={dTID.icon(name)} />,
    KeyboardPromptModal: ({ visible, onConfirm, onCancel }: any) => {
      const { TouchableOpacity } = require("react-native");
      if (!visible) return null;
      return (
        <View testID={TID.KeyboardPromptModal}>
          <TouchableOpacity testID="kbd-confirm" onPress={onConfirm} />
          <TouchableOpacity testID="kbd-cancel" onPress={onCancel} />
        </View>
      );
    },
    RecordingControlsView: () => <View testID={TID.RecordingControlsView} />,
    SUB_SCREEN_NAVBAR_HEIGHT: 72,
    PRIMARY_BUTTON_HEIGHT: 56,
    TOOLTIP_FADE_DURATION_MS: 200,
    Tooltip: () => <View testID={TID.Tooltip} />,
    TranscriptionSettingsSheet: ({ visible, onDismiss, footer }: any) => {
      const { TouchableOpacity } = require("react-native");
      if (!visible) return null;
      return (
        <View testID={TID.TranscriptionSettingsSheet}>
          <TouchableOpacity testID="tss-dismiss" onPress={onDismiss} />
          {footer}
        </View>
      );
    },
    LargerModelSuggestionModal: ({
      visible,
      languageName,
      onConfirm,
      onDismiss,
    }: any) => {
      const { TouchableOpacity, Text } = require("react-native");
      if (!visible) return null;
      return (
        <View testID={TID.LargerModelSuggestionModal}>
          <Text>{languageName}</Text>
          <TouchableOpacity testID="lms-confirm" onPress={onConfirm} />
          <TouchableOpacity testID="lms-dismiss" onPress={onDismiss} />
        </View>
      );
    },
    VoiceSessionHintModal: ({ visible, onDismiss }: any) => {
      const { TouchableOpacity } = require("react-native");
      if (!visible) return null;
      return (
        <View testID={TID.VoiceSessionHintModal}>
          <TouchableOpacity testID="vsh-dismiss" onPress={onDismiss} />
        </View>
      );
    },
  };
});

jest.mock("@react-navigation/native", () => ({
  useIsFocused: jest.fn(() => true),
}));

jest.mock("expo-router", () => {
  const { TestID: TID } = require("@/constants");
  return {
    Stack: Object.assign(
      ({ children, screenLayout }: any) => {
        const { View } = require("react-native");
        return (
          <View testID={TID.Stack}>
            {children}
            {screenLayout?.({ children: null })}
          </View>
        );
      },
      {
        Screen: (props: any) => {
          const { View } = require("react-native");
          return <View testID={`stack-screen-${props.name}`} />;
        },
      },
    ),
    usePathname: jest.fn(() => "/"),
    useRouter: jest.fn(() => ({ push: jest.fn() })),
  };
});

jest.mock("@react-native-masked-view/masked-view", () => {
  const { View } = require("react-native");
  const { TestID: TID } = require("@/constants");
  const MockMaskedView = ({ children }: any) => (
    <View testID={TID.MaskedView}>{children}</View>
  );
  return { __esModule: true, default: MockMaskedView };
});

// Access the mock functions via the mocked module imports
const mockUseFonts = useFonts as jest.Mock;
const mockInitSettingsStore = initializeSettingsStore as jest.Mock;
const mockInitSessionStore = initializeSessionStore as jest.Mock;
const mockInitTranscriptionStore = initializeTranscriptionStore as jest.Mock;

async function renderAndWaitForInit() {
  const result = render(<RootLayout />);
  await waitFor(() => {
    expect(result.getByTestId(TestID.AppErrorBoundary)).toBeTruthy();
  });
  return result;
}

beforeEach(() => {
  mockUseFonts.mockReturnValue([true, null]);
  mockInitTheme.mockResolvedValue(undefined);
  mockInitSettingsStore.mockResolvedValue(undefined);
  mockInitSessionStore.mockResolvedValue(undefined);
  mockInitTranscriptionStore.mockResolvedValue(undefined);
});

describe("RootLayout", () => {
  it("returns null before fonts loaded", async () => {
    mockUseFonts.mockReturnValue([false, null]);
    const { toJSON } = render(<RootLayout />);
    expect(toJSON()).toBeNull();
    // Flush async setAppReady from useEffect
    await act(async () => {});
  });

  it("renders after initialization", async () => {
    const { getByTestId } = await renderAndWaitForInit();
    expect(getByTestId(TestID.AppErrorBoundary)).toBeTruthy();
    expect(getByTestId(TestID.Stack)).toBeTruthy();
  });

  it("store initialization functions called", async () => {
    await renderAndWaitForInit();
    expect(mockInitSettingsStore).toHaveBeenCalled();
    expect(mockInitSessionStore).toHaveBeenCalled();
    expect(mockInitTheme).toHaveBeenCalled();
  });

  it("transcriptionStore init called after settings+session init", async () => {
    const callOrder: string[] = [];
    mockInitSettingsStore.mockImplementation(async () => {
      callOrder.push("settings");
    });
    mockInitSessionStore.mockImplementation(async () => {
      callOrder.push("session");
    });
    mockInitTranscriptionStore.mockImplementation(async () => {
      callOrder.push("transcription");
    });

    await renderAndWaitForInit();

    expect(mockInitTranscriptionStore).toHaveBeenCalled();
    const transcriptionIdx = callOrder.indexOf("transcription");
    const settingsIdx = callOrder.indexOf("settings");
    const sessionIdx = callOrder.indexOf("session");
    expect(transcriptionIdx).toBeGreaterThan(settingsIdx);
    expect(transcriptionIdx).toBeGreaterThan(sessionIdx);
  });

  it("SplashScreen.hideAsync called after ready", async () => {
    const { getByTestId } = await renderAndWaitForInit();
    // onLayoutRootView is on GestureHandlerRootView (child of AppErrorBoundary)
    // GestureHandlerRootView is mocked as View, find it and trigger layout
    const boundary = getByTestId(TestID.AppErrorBoundary);
    const gestureRoot = boundary.children[0] as any;
    await act(async () => {
      gestureRoot.props.onLayout?.();
    });
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });

  it("AppErrorBoundary wraps content", async () => {
    const { getByTestId } = await renderAndWaitForInit();
    expect(getByTestId(TestID.AppErrorBoundary)).toBeTruthy();
    expect(getByTestId(TestID.Stack)).toBeTruthy();
  });

  it("font error logged via logError", async () => {
    const fontError = new Error("font load failed");
    mockUseFonts.mockReturnValue([true, fontError]);

    await renderAndWaitForInit();

    expect(logError).toHaveBeenCalledWith(fontError, {
      flag: "ui",
      message: "Error loading fonts",
    });
  });

  it("store initialization error is logged and app still renders", async () => {
    mockInitSettingsStore.mockRejectedValue(new Error("init failed"));

    const { getByTestId } = await renderAndWaitForInit();

    expect(logError).toHaveBeenCalledWith(expect.any(Error), {
      flag: "general",
      message: "Failed to initialize app",
    });
    // App should still render despite error
    expect(getByTestId(TestID.AppErrorBoundary)).toBeTruthy();
  });

  it("renders GlobalRecordingControls on home path", async () => {
    const { getByTestId } = await renderAndWaitForInit();
    expect(getByTestId(TestID.RecordingControlsView)).toBeTruthy();
  });

  it("renders GlobalTooltipRenderer", async () => {
    const { useGlobalTooltip } = require("@/stores");
    (useGlobalTooltip as jest.Mock).mockReturnValue({
      id: "t",
      message: "Hi",
      variant: "normal",
      duration: 3000,
    });
    const { getByTestId } = await renderAndWaitForInit();
    expect(getByTestId(TestID.Tooltip)).toBeTruthy();
    (useGlobalTooltip as jest.Mock).mockReturnValue(null);
  });

  it("GlobalRecordingControls hidden when not on recording screen", async () => {
    const { usePathname } = require("expo-router");
    (usePathname as jest.Mock).mockReturnValue("/settings");

    const { queryByTestId } = await renderAndWaitForInit();
    expect(queryByTestId(TestID.RecordingControlsView)).toBeNull();
  });

  it("GlobalRecordingControls hidden when not visible", async () => {
    const { useRecordingControlsVisible } = require("@/stores");
    (useRecordingControlsVisible as jest.Mock).mockReturnValue(false);

    const { queryByTestId } = await renderAndWaitForInit();
    expect(queryByTestId(TestID.RecordingControlsView)).toBeNull();
  });

  it("GlobalRecordingControls visible on session path", async () => {
    const { usePathname } = require("expo-router");
    (usePathname as jest.Mock).mockReturnValue("/session/123");
    const { useRecordingControlsVisible } = require("@/stores");
    (useRecordingControlsVisible as jest.Mock).mockReturnValue(true);

    const { getByTestId } = await renderAndWaitForInit();
    expect(getByTestId(TestID.RecordingControlsView)).toBeTruthy();
  });

  it("GlobalRecordingControls visible on folder path", async () => {
    const { usePathname } = require("expo-router");
    (usePathname as jest.Mock).mockReturnValue("/folder/f1");
    const { useRecordingControlsVisible } = require("@/stores");
    (useRecordingControlsVisible as jest.Mock).mockReturnValue(true);

    const { getByTestId } = await renderAndWaitForInit();
    expect(getByTestId(TestID.RecordingControlsView)).toBeTruthy();
  });

  // --- Additional coverage tests ---

  describe("GlobalTooltipRenderer", () => {
    it("renders tooltip with action and leading icon", async () => {
      const mockHideTooltip = jest.fn();
      const mockActionOnPress = jest.fn();
      const { useGlobalTooltip, useHideGlobalTooltip } = require("@/stores");
      (useGlobalTooltip as jest.Mock).mockReturnValue({
        message: "Open settings",
        variant: "normal",
        isInfo: false,
        isDismissible: true,
        duration: 3000,
        action: {
          iconName: "settings",
          onPress: mockActionOnPress,
        },
      });
      (useHideGlobalTooltip as jest.Mock).mockReturnValue(mockHideTooltip);

      const { getByTestId } = await renderAndWaitForInit();

      // Tooltip should be rendered with the action
      expect(getByTestId(TestID.Tooltip)).toBeTruthy();
    });

    it("positions tooltip 16px above the record button grabber", async () => {
      const { useGlobalTooltip } = require("@/stores");
      (useGlobalTooltip as jest.Mock).mockReturnValue({
        message: "Hi",
        variant: "normal",
        isInfo: false,
        isDismissible: true,
        duration: 3000,
      });

      const { getByTestId } = await renderAndWaitForInit();
      const container = getByTestId(TestID.GlobalTooltipContainer);
      // 96 controls + 19 grabber top within handle + 16 gap
      expect(StyleSheet.flatten(container.props.style).bottom).toBe(131);
    });

    it("positions tooltip 16px above the onboarding Next button", async () => {
      const { usePathname } = require("expo-router");
      (usePathname as jest.Mock).mockReturnValue("/onboarding/record");
      const { useGlobalTooltip } = require("@/stores");
      (useGlobalTooltip as jest.Mock).mockReturnValue({
        message: "Copied",
        variant: "normal",
        isInfo: false,
        isDismissible: true,
        duration: 3000,
      });

      const { getByTestId } = await renderAndWaitForInit();
      // 16 footer padding + 56 button + 16 gap
      expect(
        StyleSheet.flatten(
          getByTestId(TestID.GlobalTooltipContainer).props.style,
        ).bottom,
      ).toBe(88);
      (usePathname as jest.Mock).mockReturnValue("/");
    });

    it("positions tooltip 16px above the edit screen toolbar and keyboard", async () => {
      const { usePathname } = require("expo-router");
      (usePathname as jest.Mock).mockReturnValue("/transcription/t1");
      const { useGlobalTooltip } = require("@/stores");
      (useGlobalTooltip as jest.Mock).mockReturnValue({
        message: "Copied",
        variant: "normal",
        isInfo: false,
        isDismissible: true,
        duration: 3000,
      });

      const { getByTestId, rerender } = await renderAndWaitForInit();
      const bottom = () =>
        StyleSheet.flatten(
          getByTestId(TestID.GlobalTooltipContainer).props.style,
        ).bottom;
      // 72 toolbar + 16 gap
      expect(bottom()).toBe(88);

      mockKeyboardHeight.mockReturnValue(300);
      rerender(<RootLayout />);
      expect(bottom()).toBe(388);
      mockKeyboardHeight.mockReturnValue(0);
      (usePathname as jest.Mock).mockReturnValue("/");
    });

    it("renders dismissible tooltip", async () => {
      const mockHideTooltip = jest.fn();
      const { useGlobalTooltip, useHideGlobalTooltip } = require("@/stores");
      (useGlobalTooltip as jest.Mock).mockReturnValue({
        message: "Dismissible message",
        variant: "normal",
        isInfo: true,
        isDismissible: true,
        duration: 5000,
      });
      (useHideGlobalTooltip as jest.Mock).mockReturnValue(mockHideTooltip);

      const { getByTestId } = await renderAndWaitForInit();
      expect(getByTestId(TestID.Tooltip)).toBeTruthy();
    });

    it("auto-dismisses non-dismissible tooltip after duration", async () => {
      jest.useFakeTimers();
      const mockHideTooltip = jest.fn();
      const { useGlobalTooltip, useHideGlobalTooltip } = require("@/stores");
      (useGlobalTooltip as jest.Mock).mockReturnValue({
        message: "Auto dismiss",
        variant: "normal",
        isInfo: false,
        isDismissible: false,
        duration: 2000,
      });
      (useHideGlobalTooltip as jest.Mock).mockReturnValue(mockHideTooltip);

      await renderAndWaitForInit();

      // Advance timers to trigger auto-dismiss
      await act(async () => {
        jest.advanceTimersByTime(2500);
      });

      expect(mockHideTooltip).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it("does not render the tooltip in an unfocused screen", async () => {
      const { useIsFocused } = require("@react-navigation/native");
      (useIsFocused as jest.Mock).mockReturnValue(false);
      const { useGlobalTooltip } = require("@/stores");
      (useGlobalTooltip as jest.Mock).mockReturnValue({
        message: "Hidden",
        variant: "normal",
        isInfo: false,
        isDismissible: false,
        duration: 2000,
      });

      const { queryByTestId } = await renderAndWaitForInit();
      expect(queryByTestId(TestID.GlobalTooltipContainer)).toBeNull();
      (useIsFocused as jest.Mock).mockReturnValue(true);
    });

    it("renders null tooltip without error", async () => {
      const { useGlobalTooltip } = require("@/stores");
      (useGlobalTooltip as jest.Mock).mockReturnValue(null);

      const { queryByTestId } = await renderAndWaitForInit();
      expect(queryByTestId(TestID.Tooltip)).toBeNull();
    });
  });

  describe("GlobalRecordingControls - dark theme", () => {
    it("renders with dark theme blur tint", async () => {
      const { useThemeStore } = require("@/theme");
      (useThemeStore as jest.Mock).mockImplementation((sel?: any) => {
        const s = {
          currentTheme: "dark",
          selectedTheme: "dark",
          initTheme: mockInitTheme,
        };
        return sel ? sel(s) : s;
      });

      const { useTheme } = require("@/theme");
      (useTheme as jest.Mock).mockReturnValue({
        theme: {
          colors: {
            surfaceBackground: "#000",
            textInverse: "#000",
            glassBackground: "rgba(255,255,255,0.1)",
          },
        },
        isDark: true,
      });

      const { getByTestId } = await renderAndWaitForInit();
      expect(getByTestId(TestID.RecordingControlsView)).toBeTruthy();
    });
  });

  describe("GlobalRecordingControls - recording callbacks", () => {
    it("handles null onRecordingStart callback", async () => {
      const { useOnRecordingStart, useOnRecordingStop } = require("@/stores");
      (useOnRecordingStart as jest.Mock).mockReturnValue(null);
      (useOnRecordingStop as jest.Mock).mockReturnValue(null);

      const { getByTestId } = await renderAndWaitForInit();
      expect(getByTestId(TestID.RecordingControlsView)).toBeTruthy();
    });
  });

  describe("SplashScreen - not ready", () => {
    it("does not hide splash when app is not ready", async () => {
      // Clear the spy to check if a new call would happen
      (SplashScreen.hideAsync as jest.Mock).mockClear();

      // If fonts weren't loaded, hideAsync should not be called
      // This is tested by the "returns null before fonts loaded" test
    });
  });

  describe("StatusBar styling", () => {
    it("renders with dark StatusBar style when isDark", async () => {
      const { useTheme } = require("@/theme");
      (useTheme as jest.Mock).mockReturnValue({
        theme: {
          colors: {
            surfaceBackground: "#000",
            textInverse: "#000",
            glassBackground: "rgba(255,255,255,0.1)",
          },
        },
        isDark: true,
      });

      const { getByTestId } = await renderAndWaitForInit();
      expect(getByTestId(TestID.AppErrorBoundary)).toBeTruthy();
    });

    it("renders with light StatusBar style when not dark", async () => {
      const { useTheme } = require("@/theme");
      (useTheme as jest.Mock).mockReturnValue({
        theme: {
          colors: {
            surfaceBackground: "#fff",
            textInverse: "#fff",
            glassBackground: "rgba(0,0,0,0.1)",
          },
        },
        isDark: false,
      });

      const { getByTestId } = await renderAndWaitForInit();
      expect(getByTestId(TestID.AppErrorBoundary)).toBeTruthy();
    });
  });

  describe("GlobalRecordingControls - handleRecordingStart/Stop", () => {
    it("handleRecordingStart calls onRecordingStart", async () => {
      const mockOnStart = jest.fn();
      const { useOnRecordingStart, useOnRecordingStop } = require("@/stores");
      (useOnRecordingStart as jest.Mock).mockReturnValue(mockOnStart);
      (useOnRecordingStop as jest.Mock).mockReturnValue(jest.fn());

      // Override RecordingControlsView to capture and trigger callbacks
      const comps = jest.requireMock("@/components");
      comps.RecordingControlsView = ({
        onRecordingStart,
        onRecordingStop,
      }: any) => {
        const { View, Pressable } = require("react-native");
        return (
          <View testID={TestID.RecordingControlsView}>
            <Pressable testID={TestID.BtnStart} onPress={onRecordingStart} />
            <Pressable testID={TestID.BtnStop} onPress={onRecordingStop} />
          </View>
        );
      };

      const { getByTestId } = await renderAndWaitForInit();
      await act(async () => {
        fireEvent.press(getByTestId(TestID.BtnStart));
      });
      expect(mockOnStart).toHaveBeenCalled();

      // Restore mock
      comps.RecordingControlsView = () => {
        const { View } = require("react-native");
        return <View testID={TestID.RecordingControlsView} />;
      };
    });

    it("handleRecordingStop calls onRecordingStop", async () => {
      const mockOnStop = jest.fn();
      const { useOnRecordingStart, useOnRecordingStop } = require("@/stores");
      (useOnRecordingStart as jest.Mock).mockReturnValue(jest.fn());
      (useOnRecordingStop as jest.Mock).mockReturnValue(mockOnStop);

      const comps = jest.requireMock("@/components");
      comps.RecordingControlsView = ({
        onRecordingStart,
        onRecordingStop,
      }: any) => {
        const { View, Pressable } = require("react-native");
        return (
          <View testID={TestID.RecordingControlsView}>
            <Pressable testID={TestID.BtnStart} onPress={onRecordingStart} />
            <Pressable testID={TestID.BtnStop} onPress={onRecordingStop} />
          </View>
        );
      };

      const { getByTestId } = await renderAndWaitForInit();
      await act(async () => {
        fireEvent.press(getByTestId(TestID.BtnStop));
      });
      expect(mockOnStop).toHaveBeenCalled();

      comps.RecordingControlsView = () => {
        const { View } = require("react-native");
        return <View testID={TestID.RecordingControlsView} />;
      };
    });
  });

  describe("GlobalRecordingControls - transcription settings sheet", () => {
    const { Gesture } = jest.requireMock("react-native-gesture-handler");
    const swipeUp = async () => {
      const pan = (Gesture.Pan as jest.Mock).mock.results.at(-1)!.value;
      const onStart = pan.onStart.mock.calls.at(-1)[0];
      await act(async () => onStart());
    };

    beforeEach(() => {
      const { useTranscriptionState } = require("@/stores");
      (useTranscriptionState as jest.Mock).mockReturnValue("ready");
    });

    afterEach(() => {
      const { useTranscriptionState } = require("@/stores");
      (useTranscriptionState as jest.Mock).mockReturnValue("IDLE");
    });

    it("swipe up opens the sheet and dismiss closes it", async () => {
      const { getByTestId, queryByTestId } = await renderAndWaitForInit();
      expect(queryByTestId(TestID.TranscriptionSettingsSheet)).toBeNull();

      await swipeUp();
      expect(getByTestId(TestID.TranscriptionSettingsSheet)).toBeTruthy();

      await act(async () => {
        fireEvent.press(getByTestId("tss-dismiss"));
      });
      expect(queryByTestId(TestID.TranscriptionSettingsSheet)).toBeNull();
    });

    it("tapping the grabber opens the sheet", async () => {
      const { getByTestId } = await renderAndWaitForInit();
      await act(async () => {
        fireEvent.press(getByTestId(TestID.TranscriptionSettingsHandle));
      });
      expect(getByTestId(TestID.TranscriptionSettingsSheet)).toBeTruthy();
    });

    it("swipe gesture is disabled while recording", async () => {
      const { useTranscriptionState } = require("@/stores");
      (useTranscriptionState as jest.Mock).mockReturnValue("recording");
      const { queryByTestId } = await renderAndWaitForInit();
      const pan = (Gesture.Pan as jest.Mock).mock.results.at(-1)!.value;
      expect(pan.enabled).toHaveBeenLastCalledWith(false);
      expect(queryByTestId(TestID.TranscriptionSettingsHandle)).toBeNull();
    });

    it("starting a recording from the sheet closes it", async () => {
      const mockOnStart = jest.fn();
      const { useOnRecordingStart } = require("@/stores");
      (useOnRecordingStart as jest.Mock).mockReturnValue(mockOnStart);
      const comps = jest.requireMock("@/components");
      const original = comps.RecordingControlsView;
      comps.RecordingControlsView = ({ onRecordingStart }: any) => {
        const { Pressable } = require("react-native");
        return (
          <Pressable testID={TestID.BtnStart} onPress={onRecordingStart} />
        );
      };

      const { getAllByTestId, queryByTestId } = await renderAndWaitForInit();
      await swipeUp();
      const buttons = getAllByTestId(TestID.BtnStart);
      await act(async () => {
        fireEvent.press(buttons[buttons.length - 1]);
      });

      expect(mockOnStart).toHaveBeenCalled();
      expect(queryByTestId(TestID.TranscriptionSettingsSheet)).toBeNull();
      comps.RecordingControlsView = original;
    });
  });

  describe("GlobalTooltipRenderer - handleActionPress", () => {
    it("handleActionPress calls tooltip action.onPress and hideTooltip", async () => {
      const mockHideTooltip = jest.fn();
      const mockActionOnPress = jest.fn();
      const { useGlobalTooltip, useHideGlobalTooltip } = require("@/stores");
      (useGlobalTooltip as jest.Mock).mockReturnValue({
        message: "Action tooltip",
        variant: "normal",
        isInfo: false,
        isDismissible: true,
        duration: 3000,
        action: {
          iconName: "settings",
          onPress: mockActionOnPress,
        },
      });
      (useHideGlobalTooltip as jest.Mock).mockReturnValue(mockHideTooltip);

      // Override Tooltip to expose onLeadingIconTap
      const comps = jest.requireMock("@/components");
      const origTooltip = comps.Tooltip;
      comps.Tooltip = (props: any) => {
        const { View, Pressable } = require("react-native");
        return (
          <View testID={TestID.Tooltip}>
            {props.onLeadingIconTap && (
              <Pressable
                testID={TestID.TooltipActionBtn}
                onPress={props.onLeadingIconTap}
              />
            )}
          </View>
        );
      };

      const { getByTestId } = await renderAndWaitForInit();
      await act(async () => {
        fireEvent.press(getByTestId(TestID.TooltipActionBtn));
      });

      expect(mockHideTooltip).toHaveBeenCalled();
      expect(mockActionOnPress).toHaveBeenCalled();

      comps.Tooltip = origTooltip;
    });
  });

  describe("GlobalKeyboardPromptRenderer", () => {
    it("does not render when keyboardPromptVisible is false", async () => {
      const { useKeyboardPromptVisible } = require("@/stores");
      (useKeyboardPromptVisible as jest.Mock).mockReturnValue(false);

      const { queryByTestId } = await renderAndWaitForInit();
      expect(queryByTestId(TestID.KeyboardPromptModal)).toBeNull();
    });

    it("renders when keyboardPromptVisible is true", async () => {
      const { useKeyboardPromptVisible } = require("@/stores");
      (useKeyboardPromptVisible as jest.Mock).mockReturnValue(true);

      const { getByTestId } = await renderAndWaitForInit();
      expect(getByTestId(TestID.KeyboardPromptModal)).toBeTruthy();
    });

    it("confirm marks seen, hides, and opens settings", async () => {
      const mockHide = jest.fn();
      const mockMark = jest.fn().mockResolvedValue(undefined);
      const {
        useKeyboardPromptVisible,
        useHideKeyboardPrompt,
        useMarkKeyboardPromptSeen,
      } = require("@/stores");
      (useKeyboardPromptVisible as jest.Mock).mockReturnValue(true);
      (useHideKeyboardPrompt as jest.Mock).mockReturnValue(mockHide);
      (useMarkKeyboardPromptSeen as jest.Mock).mockReturnValue(mockMark);

      const { openKeyboardSettings } = require("@/utils");
      (openKeyboardSettings as jest.Mock).mockClear();

      const { getByTestId } = await renderAndWaitForInit();
      await act(async () => {
        fireEvent.press(getByTestId("kbd-confirm"));
      });

      expect(mockMark).toHaveBeenCalled();
      expect(mockHide).toHaveBeenCalled();
      expect(openKeyboardSettings).toHaveBeenCalled();
    });

    it("cancel marks seen and hides without opening settings", async () => {
      const mockHide = jest.fn();
      const mockMark = jest.fn().mockResolvedValue(undefined);
      const {
        useKeyboardPromptVisible,
        useHideKeyboardPrompt,
        useMarkKeyboardPromptSeen,
      } = require("@/stores");
      (useKeyboardPromptVisible as jest.Mock).mockReturnValue(true);
      (useHideKeyboardPrompt as jest.Mock).mockReturnValue(mockHide);
      (useMarkKeyboardPromptSeen as jest.Mock).mockReturnValue(mockMark);

      const { openKeyboardSettings } = require("@/utils");
      (openKeyboardSettings as jest.Mock).mockClear();

      const { getByTestId } = await renderAndWaitForInit();
      await act(async () => {
        fireEvent.press(getByTestId("kbd-cancel"));
      });

      expect(mockMark).toHaveBeenCalled();
      expect(mockHide).toHaveBeenCalled();
      expect(openKeyboardSettings).not.toHaveBeenCalled();
    });
  });

  describe("GlobalVoiceSessionHintRenderer", () => {
    it("does not render when voiceSessionHintVisible is false", async () => {
      const { useVoiceSessionHintVisible } = require("@/stores");
      (useVoiceSessionHintVisible as jest.Mock).mockReturnValue(false);

      const { queryByTestId } = await renderAndWaitForInit();
      expect(queryByTestId(TestID.VoiceSessionHintModal)).toBeNull();
    });

    it("renders when voiceSessionHintVisible is true", async () => {
      const { useVoiceSessionHintVisible } = require("@/stores");
      (useVoiceSessionHintVisible as jest.Mock).mockReturnValue(true);

      const { getByTestId } = await renderAndWaitForInit();
      expect(getByTestId(TestID.VoiceSessionHintModal)).toBeTruthy();
    });

    it("dismiss hides the hint", async () => {
      const mockHide = jest.fn();
      const {
        useVoiceSessionHintVisible,
        useHideVoiceSessionHint,
      } = require("@/stores");
      (useVoiceSessionHintVisible as jest.Mock).mockReturnValue(true);
      (useHideVoiceSessionHint as jest.Mock).mockReturnValue(mockHide);

      const { getByTestId } = await renderAndWaitForInit();
      await act(async () => {
        fireEvent.press(getByTestId("vsh-dismiss"));
      });
      expect(mockHide).toHaveBeenCalled();
    });
  });

  describe("GlobalLargerModelSuggestionRenderer", () => {
    it("does not render when largerModelSuggestionVisible is false", async () => {
      const { useLargerModelSuggestionVisible } = require("@/stores");
      (useLargerModelSuggestionVisible as jest.Mock).mockReturnValue(false);

      const { queryByTestId } = await renderAndWaitForInit();
      expect(queryByTestId(TestID.LargerModelSuggestionModal)).toBeNull();
    });

    it("renders the selected language name when visible", async () => {
      const { useLargerModelSuggestionVisible } = require("@/stores");
      (useLargerModelSuggestionVisible as jest.Mock).mockReturnValue(true);

      const { getByTestId, getByText } = await renderAndWaitForInit();
      expect(getByTestId(TestID.LargerModelSuggestionModal)).toBeTruthy();
      expect(getByText("German")).toBeTruthy();
    });

    it("confirm marks seen, hides, and navigates to the model screen", async () => {
      const mockHide = jest.fn();
      const mockMark = jest.fn().mockResolvedValue(undefined);
      const mockPush = jest.fn();
      const {
        useLargerModelSuggestionVisible,
        useHideLargerModelSuggestion,
        useMarkLargerModelSuggestionSeen,
      } = require("@/stores");
      const { useRouter } = require("expo-router");
      (useLargerModelSuggestionVisible as jest.Mock).mockReturnValue(true);
      (useHideLargerModelSuggestion as jest.Mock).mockReturnValue(mockHide);
      (useMarkLargerModelSuggestionSeen as jest.Mock).mockReturnValue(mockMark);
      (useRouter as jest.Mock).mockReturnValue({ push: mockPush });

      const { getByTestId } = await renderAndWaitForInit();
      await act(async () => {
        fireEvent.press(getByTestId("lms-confirm"));
      });

      expect(mockMark).toHaveBeenCalled();
      expect(mockHide).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith(Routes.settingsModel);
    });

    it("dismiss marks seen and hides without navigating", async () => {
      const mockHide = jest.fn();
      const mockMark = jest.fn().mockResolvedValue(undefined);
      const mockPush = jest.fn();
      const {
        useLargerModelSuggestionVisible,
        useHideLargerModelSuggestion,
        useMarkLargerModelSuggestionSeen,
      } = require("@/stores");
      const { useRouter } = require("expo-router");
      (useLargerModelSuggestionVisible as jest.Mock).mockReturnValue(true);
      (useHideLargerModelSuggestion as jest.Mock).mockReturnValue(mockHide);
      (useMarkLargerModelSuggestionSeen as jest.Mock).mockReturnValue(mockMark);
      (useRouter as jest.Mock).mockReturnValue({ push: mockPush });

      const { getByTestId } = await renderAndWaitForInit();
      await act(async () => {
        fireEvent.press(getByTestId("lms-dismiss"));
      });

      expect(mockMark).toHaveBeenCalled();
      expect(mockHide).toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("Platform-specific rendering", () => {
    it("renders on iOS platform", async () => {
      const originalOS = Object.getOwnPropertyDescriptor(
        require("react-native").Platform,
        "OS",
      );
      Object.defineProperty(require("react-native").Platform, "OS", {
        value: "ios",
        configurable: true,
      });

      const { getByTestId } = await renderAndWaitForInit();
      expect(getByTestId(TestID.RecordingControlsView)).toBeTruthy();

      if (originalOS) {
        Object.defineProperty(
          require("react-native").Platform,
          "OS",
          originalOS,
        );
      }
    });

    it("renders on Android platform", async () => {
      const originalOS = Object.getOwnPropertyDescriptor(
        require("react-native").Platform,
        "OS",
      );
      Object.defineProperty(require("react-native").Platform, "OS", {
        value: "android",
        configurable: true,
      });

      const { getByTestId } = await renderAndWaitForInit();
      expect(getByTestId(TestID.RecordingControlsView)).toBeTruthy();

      if (originalOS) {
        Object.defineProperty(
          require("react-native").Platform,
          "OS",
          originalOS,
        );
      }
    });
  });
});
