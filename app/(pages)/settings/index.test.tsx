/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import * as IntentLauncher from "expo-intent-launcher";
import * as Linking from "expo-linking";
import * as LocalAuthentication from "expo-local-authentication";
import React from "react";
import { Platform } from "react-native";

import SettingsScreen from "./index";

// --- Mocks ---

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
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

const mockSetBiometricAuthEnabled = jest.fn();
const mockShowGlobalTooltip = jest.fn();
jest.mock("@/stores", () => ({
  useSelectedTheme: jest.fn(() => "auto"),
  useBiometricAuthEnabled: jest.fn(() => false),
  useSetBiometricAuthEnabled: () => mockSetBiometricAuthEnabled,
  useShowGlobalTooltip: () => mockShowGlobalTooltip,
}));

jest.mock("@/models", () => ({
  AppTheme: { AUTO: "auto", LIGHT: "light", DARK: "dark" },
}));

jest.mock("@/components", () => {
  const { View, Text, TouchableOpacity } = require("react-native");
  const { TestID: TID, dynamicTestID: dTID } = require("@/constants");
  return {
    AppBarBlurTarget: ({ children }: any) => <View>{children}</View>,
    authenticateBiometric: jest.requireActual(
      "@/components/shared/biometric-lock/biometricAuth",
    ).authenticateBiometric,
    Card: ({ children, ...rest }: any) => (
      <View testID={TID.Card} {...rest}>
        {children}
      </View>
    ),
    Divider: () => <View testID={TID.Divider} />,
    Icon: ({ name }: any) => <View testID={dTID.icon(name)} />,
    InAppBanner: () => <View testID={TID.InAppBanner} />,
    ListItem: ({ title, titleTrailing, onPress, iconTrailing }: any) => (
      <TouchableOpacity testID={dTID.listItem(title)} onPress={onPress}>
        <Text>{String(title)}</Text>
        {titleTrailing && (
          <Text testID={dTID.trailing(title)}>{String(titleTrailing)}</Text>
        )}
        {iconTrailing}
      </TouchableOpacity>
    ),
    Screen: ({ children }: any) => <View>{children}</View>,
    Text: ({ children }: any) => <Text>{String(children)}</Text>,
    Toggle: () => <View />,
    SettingsFooter: () => <View testID={TID.SettingsFooter} />,
    TopAppBar: ({ title }: any) => (
      <View testID={TID.TopAppBar}>
        <Text>{String(title)}</Text>
      </View>
    ),
  };
});

describe("SettingsScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders sections and items", () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <SettingsScreen />,
    );
    expect(getByText("settingsSectionTranscription")).toBeTruthy();
    expect(getByText("settingsSectionAppearance")).toBeTruthy();
    expect(getByText("settingsSectionGeneral")).toBeTruthy();
    expect(getByTestId("list-item-title")).toBeTruthy();
    expect(getByTestId("list-item-themeTitle")).toBeTruthy();
    expect(getByTestId("list-item-advancedSettingsTitle")).toBeTruthy();
    expect(getByTestId("list-item-biometricAuthTitle")).toBeTruthy();
    expect(queryByTestId("list-item-spokenLanguageTitle")).toBeNull();
  });

  it("biometric toggle enables after successful authentication", async () => {
    const { getByTestId } = render(<SettingsScreen />);
    fireEvent.press(getByTestId("list-item-biometricAuthTitle"));
    await waitFor(() =>
      expect(mockSetBiometricAuthEnabled).toHaveBeenCalledWith(true),
    );
  });

  it("biometric toggle does nothing when user cancels", async () => {
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: "user_cancel",
    });
    const { getByTestId } = render(<SettingsScreen />);
    fireEvent.press(getByTestId("list-item-biometricAuthTitle"));
    await waitFor(() =>
      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled(),
    );
    expect(mockSetBiometricAuthEnabled).not.toHaveBeenCalled();
    expect(mockShowGlobalTooltip).not.toHaveBeenCalled();
  });

  it("biometric toggle shows tooltip when device has no auth set up", async () => {
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: "not_enrolled",
    });
    const { getByTestId } = render(<SettingsScreen />);
    fireEvent.press(getByTestId("list-item-biometricAuthTitle"));
    await waitFor(() =>
      expect(mockShowGlobalTooltip).toHaveBeenCalledWith(
        expect.anything(),
        "error",
        5000,
      ),
    );
    expect(mockSetBiometricAuthEnabled).not.toHaveBeenCalled();
  });

  it("biometric toggle ignores a rejected authentication", async () => {
    (LocalAuthentication.authenticateAsync as jest.Mock).mockRejectedValueOnce(
      new Error("boom"),
    );
    const { getByTestId } = render(<SettingsScreen />);
    fireEvent.press(getByTestId("list-item-biometricAuthTitle"));
    await waitFor(() =>
      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled(),
    );
    expect(mockSetBiometricAuthEnabled).not.toHaveBeenCalled();
  });

  it("theme item shows current theme display text", () => {
    const { getByTestId } = render(<SettingsScreen />);
    // selectedTheme is 'auto' → themeDisplay = loc.auto
    expect(getByTestId("trailing-themeTitle")).toHaveTextContent("auto");
  });

  it("settings item press navigates to correct route", () => {
    const { getByTestId } = render(<SettingsScreen />);
    fireEvent.press(getByTestId("list-item-title"));
    expect(mockPush).toHaveBeenCalledWith("/settings/model");

    fireEvent.press(getByTestId("list-item-themeTitle"));
    expect(mockPush).toHaveBeenCalledWith("/settings/theme");

    fireEvent.press(getByTestId("list-item-textAppearanceTitle"));
    expect(mockPush).toHaveBeenCalledWith("/settings/text-appearance");

    fireEvent.press(getByTestId("list-item-advancedSettingsTitle"));
    expect(mockPush).toHaveBeenCalledWith("/settings/advanced");
  });

  it("contact support opens external URL via Linking", () => {
    const { getByTestId } = render(<SettingsScreen />);
    fireEvent.press(getByTestId("list-item-contactSupport"));
    expect(Linking.openURL).toHaveBeenCalledWith(
      "https://a1lab.zendesk.com/hc/en-us/requests/new",
    );
  });

  describe("app language row", () => {
    const original = { OS: Platform.OS, Version: Platform.Version };
    const setPlatform = (OS: string, Version: number | string) => {
      Object.defineProperty(Platform, "OS", { value: OS, configurable: true });
      Object.defineProperty(Platform, "Version", {
        value: Version,
        configurable: true,
      });
    };
    afterEach(() => setPlatform(original.OS, original.Version));

    it("shows the current UI language and opens iOS Settings", () => {
      setPlatform("ios", "18.0");
      const { getByTestId } = render(<SettingsScreen />);
      expect(getByTestId("trailing-appLanguageTitle")).toHaveTextContent("EN");
      fireEvent.press(getByTestId("list-item-appLanguageTitle"));
      expect(Linking.openSettings).toHaveBeenCalled();
    });

    it("opens the per-app language page on Android 13+", () => {
      setPlatform("android", 33);
      const { getByTestId } = render(<SettingsScreen />);
      fireEvent.press(getByTestId("list-item-appLanguageTitle"));
      expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
        "android.settings.APP_LOCALE_SETTINGS",
        { data: expect.stringMatching(/^package:/) },
      );
    });

    it("is hidden on Android 12 and below", () => {
      setPlatform("android", 32);
      const { queryByTestId } = render(<SettingsScreen />);
      expect(queryByTestId("list-item-appLanguageTitle")).toBeNull();
    });
  });

  it("model item shows no trailing model name", () => {
    const { queryByTestId } = render(<SettingsScreen />);
    expect(queryByTestId("trailing-title")).toBeNull();
  });

  it("theme item shows light display text when light selected", () => {
    const { useSelectedTheme } = require("@/stores");
    (useSelectedTheme as jest.Mock).mockReturnValue("light");

    const { getByTestId } = render(<SettingsScreen />);
    expect(getByTestId("trailing-themeTitle")).toHaveTextContent("light");
  });

  it("theme item shows dark display text when dark selected", () => {
    const { useSelectedTheme } = require("@/stores");
    (useSelectedTheme as jest.Mock).mockReturnValue("dark");

    const { getByTestId } = render(<SettingsScreen />);
    expect(getByTestId("trailing-themeTitle")).toHaveTextContent("dark");
  });

  it("theme item shows auto for unknown theme value (default case)", () => {
    const { useSelectedTheme } = require("@/stores");
    (useSelectedTheme as jest.Mock).mockReturnValue("unknown_value");

    const { getByTestId } = render(<SettingsScreen />);
    expect(getByTestId("trailing-themeTitle")).toHaveTextContent("auto");
  });

  it("renders InAppBanner and SettingsFooter", () => {
    const { getByTestId } = render(<SettingsScreen />);
    expect(getByTestId("in-app-banner")).toBeTruthy();
    expect(getByTestId("settings-footer")).toBeTruthy();
  });
});
