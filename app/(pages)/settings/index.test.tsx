/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import * as Linking from "expo-linking";
import React from "react";

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

const { mockMakeLoc } = require("../../../test-utils/mockLocalization");

jest.mock("@/hooks", () => ({
  useLocalization: jest.fn(() => ({ loc: mockMakeLoc() })),
}));

jest.mock("@/stores", () => ({
  useSelectedModelId: jest.fn(() => "whisper_tiny"),
  useSelectedTheme: jest.fn(() => "auto"),
  useSelectedLanguage: jest.fn(() => ({ code: "en", name: "English" })),
}));

jest.mock("@/models", () => ({
  AppTheme: { AUTO: "auto", LIGHT: "light", DARK: "dark" },
  getModelInfo: jest.fn(() => ({ name: "Whisper Tiny" })),
}));

jest.mock("@/components", () => {
  const { View, Text, TouchableOpacity } = require("react-native");
  const { TestID: TID, dynamicTestID: dTID } = require("@/constants");
  return {
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
    SettingsFooter: () => <View testID={TID.SettingsFooter} />,
    TopAppBar: ({ title }: any) => (
      <View testID={TID.TopAppBar}>
        <Text>{String(title)}</Text>
      </View>
    ),
  };
});

describe("SettingsScreen", () => {
  it("renders settings items (model, theme, language, advanced titles)", () => {
    const { getByTestId } = render(<SettingsScreen />);
    expect(getByTestId("list-item-title")).toBeTruthy();
    expect(getByTestId("list-item-themeTitle")).toBeTruthy();
    expect(getByTestId("list-item-spokenLanguageTitle")).toBeTruthy();
    expect(getByTestId("list-item-advancedSettingsTitle")).toBeTruthy();
  });

  it("model item shows current model name", () => {
    const { getByTestId } = render(<SettingsScreen />);
    expect(getByTestId("trailing-title")).toHaveTextContent("Whisper Tiny");
  });

  it("theme item shows current theme display text", () => {
    const { getByTestId } = render(<SettingsScreen />);
    // selectedTheme is 'auto' → themeDisplay = loc.auto
    expect(getByTestId("trailing-themeTitle")).toHaveTextContent("auto");
  });

  it("language item shows uppercase language code", () => {
    const { getByTestId } = render(<SettingsScreen />);
    expect(getByTestId("trailing-spokenLanguageTitle")).toHaveTextContent("EN");
  });

  it("settings item press navigates to correct route", () => {
    const { getByTestId } = render(<SettingsScreen />);
    fireEvent.press(getByTestId("list-item-title"));
    expect(mockPush).toHaveBeenCalledWith("/settings/model");

    fireEvent.press(getByTestId("list-item-themeTitle"));
    expect(mockPush).toHaveBeenCalledWith("/settings/theme");

    fireEvent.press(getByTestId("list-item-spokenLanguageTitle"));
    expect(mockPush).toHaveBeenCalledWith("/settings/language");

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

  it("model item shows parakeet name when parakeet selected", () => {
    const { useSelectedModelId } = require("@/stores");
    const { getModelInfo } = require("@/models");
    (useSelectedModelId as jest.Mock).mockReturnValue("nemo_parakeet_v3");
    (getModelInfo as jest.Mock).mockReturnValue({ name: "Parakeet V3" });

    const { getByTestId } = render(<SettingsScreen />);
    expect(getByTestId("trailing-title")).toHaveTextContent("Parakeet V3");
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
