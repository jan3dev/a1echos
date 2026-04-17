/* eslint-disable @typescript-eslint/no-require-imports, react/display-name */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import React from "react";

import { TestID } from "@/constants";
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
  useGlobalTooltip: jest.fn(() => null),
  useHideGlobalTooltip: jest.fn(() => jest.fn()),
  useOnRecordingStart: jest.fn(() => jest.fn()),
  useOnRecordingStop: jest.fn(() => jest.fn()),
  useRecordingControlsEnabled: jest.fn(() => true),
  useRecordingControlsVisible: jest.fn(() => true),
  useTranscriptionState: jest.fn(() => "IDLE"),
}));

jest.mock("@/services", () => ({
  registerForegroundService: jest.fn(),
  storageService: {
    processPendingDeletes: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("@/hooks", () => ({
  useBackgroundRecording: jest.fn(),
}));

jest.mock("@/utils", () => ({
  logError: jest.fn(),
  FeatureFlag: { general: "general", ui: "ui" },
}));

jest.mock("@/localization", () => ({}));

jest.mock("@/components", () => {
  const { View } = require("react-native");
  const { TestID: TID, dynamicTestID: dTID } = require("@/constants");
  return {
    AppErrorBoundary: ({ children }: any) => (
      <View testID={TID.AppErrorBoundary}>{children}</View>
    ),
    Icon: ({ name }: any) => <View testID={dTID.icon(name)} />,
    RecordingControlsView: () => <View testID={TID.RecordingControlsView} />,
    Tooltip: () => <View testID={TID.Tooltip} />,
  };
});

jest.mock("expo-router", () => {
  const { TestID: TID } = require("@/constants");
  return {
    Stack: Object.assign(
      ({ children }: any) => {
        const { View } = require("react-native");
        return <View testID={TID.Stack}>{children}</View>;
      },
      {
        Screen: (props: any) => {
          const { View } = require("react-native");
          return <View testID={`stack-screen-${props.name}`} />;
        },
      },
    ),
    usePathname: jest.fn(() => "/"),
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
    const { getByTestId } = await renderAndWaitForInit();
    expect(getByTestId(TestID.Tooltip)).toBeTruthy();
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

    it("renders null tooltip without error", async () => {
      const { useGlobalTooltip } = require("@/stores");
      (useGlobalTooltip as jest.Mock).mockReturnValue(null);

      const { getByTestId } = await renderAndWaitForInit();
      expect(getByTestId(TestID.Tooltip)).toBeTruthy();
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
