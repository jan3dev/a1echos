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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { mockMakeLoc } = require("../../../test-utils/mockLocalization");

jest.mock("@/hooks", () => ({
  useLocalization: jest.fn(() => ({ loc: mockMakeLoc() })),
}));

jest.mock("@/stores", () => ({
  useSelectedModelType: jest.fn(() => "whisper_file"),
  useSelectedTheme: jest.fn(() => "auto"),
  useSelectedLanguage: jest.fn(() => ({ code: "en", name: "English" })),
}));

jest.mock("@/components", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text, TouchableOpacity } = require("react-native");
  return {
    Card: ({ children, ...rest }: any) => (
      <View testID="card" {...rest}>
        {children}
      </View>
    ),
    Divider: () => <View testID="divider" />,
    Icon: ({ name }: any) => <View testID={`icon-${name}`} />,
    InAppBanner: () => <View testID="in-app-banner" />,
    ListItem: ({ title, titleTrailing, onPress, iconTrailing }: any) => (
      <TouchableOpacity testID={`list-item-${title}`} onPress={onPress}>
        <Text>{String(title)}</Text>
        {titleTrailing && (
          <Text testID={`trailing-${title}`}>{String(titleTrailing)}</Text>
        )}
        {iconTrailing}
      </TouchableOpacity>
    ),
    SettingsFooter: () => <View testID="settings-footer" />,
    TopAppBar: ({ title }: any) => (
      <View testID="top-app-bar">
        <Text>{String(title)}</Text>
      </View>
    ),
  };
});

describe("SettingsScreen", () => {
  it("renders settings items (model, theme, language titles)", () => {
    const { getByTestId } = render(<SettingsScreen />);
    expect(getByTestId("list-item-modelTitle")).toBeTruthy();
    expect(getByTestId("list-item-themeTitle")).toBeTruthy();
    expect(getByTestId("list-item-spokenLanguageTitle")).toBeTruthy();
  });

  it("model item shows current model display text", () => {
    const { getByTestId } = render(<SettingsScreen />);
    // selectedModelType is 'whisper_file' → modelDisplay = loc.whisperModelFileTitle
    expect(getByTestId("trailing-modelTitle")).toHaveTextContent(
      "whisperModelFileTitle",
    );
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
    fireEvent.press(getByTestId("list-item-modelTitle"));
    expect(mockPush).toHaveBeenCalledWith("/settings/model");

    fireEvent.press(getByTestId("list-item-themeTitle"));
    expect(mockPush).toHaveBeenCalledWith("/settings/theme");

    fireEvent.press(getByTestId("list-item-spokenLanguageTitle"));
    expect(mockPush).toHaveBeenCalledWith("/settings/language");
  });

  it("contact support opens external URL via Linking", () => {
    const { getByTestId } = render(<SettingsScreen />);
    fireEvent.press(getByTestId("list-item-contactSupport"));
    expect(Linking.openURL).toHaveBeenCalledWith(
      "https://a1lab.zendesk.com/hc/en-us/requests/new",
    );
  });
});
