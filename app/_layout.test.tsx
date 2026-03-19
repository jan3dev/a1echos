/* eslint-disable @typescript-eslint/no-require-imports */
import { act, render, waitFor } from "@testing-library/react-native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import React from "react";

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
  return {
    AppErrorBoundary: ({ children }: any) => (
      <View testID="app-error-boundary">{children}</View>
    ),
    Icon: ({ name }: any) => <View testID={`icon-${name}`} />,
    RecordingControlsView: () => <View testID="recording-controls-view" />,
    Tooltip: () => <View testID="tooltip" />,
  };
});

jest.mock("expo-router", () => ({
  Stack: Object.assign(
    ({ children }: any) => {
      const { View } = require("react-native");
      return <View testID="stack">{children}</View>;
    },
    {
      Screen: (props: any) => {
        const { View } = require("react-native");
        return <View testID={`stack-screen-${props.name}`} />;
      },
    },
  ),
  usePathname: jest.fn(() => "/"),
}));

jest.mock("@react-native-masked-view/masked-view", () => {
  const { View } = require("react-native");
  const MockMaskedView = ({ children }: any) => (
    <View testID="masked-view">{children}</View>
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
    expect(result.getByTestId("app-error-boundary")).toBeTruthy();
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
    expect(getByTestId("app-error-boundary")).toBeTruthy();
    expect(getByTestId("stack")).toBeTruthy();
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
    const boundary = getByTestId("app-error-boundary");
    const gestureRoot = boundary.children[0] as any;
    await act(async () => {
      gestureRoot.props.onLayout?.();
    });
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });

  it("AppErrorBoundary wraps content", async () => {
    const { getByTestId } = await renderAndWaitForInit();
    expect(getByTestId("app-error-boundary")).toBeTruthy();
    expect(getByTestId("stack")).toBeTruthy();
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
});
