/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

import LanguageSettingsScreen from "./language";

// --- Mocks ---

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
}));

const mockSetLanguage = jest.fn();

const mockLanguages = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
];

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

jest.mock("@/models", () => ({
  getCountryCode: jest.fn((lang: any) => `flag_${lang.code}`),
  SupportedLanguages: {
    get all() {
      return mockLanguages;
    },
  },
}));

jest.mock("@/stores", () => ({
  useSelectedLanguage: jest.fn(() => ({ code: "en", name: "English" })),
  useSetLanguage: jest.fn(() => mockSetLanguage),
}));

jest.mock("@/utils", () => ({
  delay: jest.fn(() => Promise.resolve()),
  logError: jest.fn(),
  FeatureFlag: { settings: "settings" },
}));

jest.mock("@/components", () => {
  const { View, Text, TouchableOpacity } = require("react-native");
  return {
    Card: ({ children }: any) => <View testID="card">{children}</View>,
    Divider: () => <View testID="divider" />,
    FlagIcon: ({ name }: any) => <View testID={`flag-icon-${name}`} />,
    ListItem: ({ title, onPress, iconTrailing, iconLeading }: any) => (
      <TouchableOpacity testID={`list-item-${title}`} onPress={onPress}>
        {iconLeading}
        <Text>{String(title)}</Text>
        {iconTrailing}
      </TouchableOpacity>
    ),
    Radio: ({ value, groupValue, onValueChange }: any) => (
      <TouchableOpacity
        testID={`radio-${value}`}
        onPress={() => onValueChange?.(value)}
      >
        <Text testID={`radio-selected-${value}`}>
          {value === groupValue ? "selected" : "unselected"}
        </Text>
      </TouchableOpacity>
    ),
    Text: ({ children }: any) => <Text>{String(children)}</Text>,
    TopAppBar: ({ title }: any) => (
      <View testID="top-app-bar">
        <Text>{String(title)}</Text>
      </View>
    ),
  };
});

describe("LanguageSettingsScreen", () => {
  it("renders language list items", () => {
    const { getByTestId } = render(<LanguageSettingsScreen />);
    expect(getByTestId("list-item-English")).toBeTruthy();
    expect(getByTestId("list-item-Spanish")).toBeTruthy();
    expect(getByTestId("list-item-French")).toBeTruthy();
  });

  it("current language radio is selected", () => {
    const { getByTestId } = render(<LanguageSettingsScreen />);
    expect(getByTestId("radio-selected-en")).toHaveTextContent("selected");
    expect(getByTestId("radio-selected-es")).toHaveTextContent("unselected");
    expect(getByTestId("radio-selected-fr")).toHaveTextContent("unselected");
  });

  it("selecting same language navigates back without calling setLanguage", () => {
    const { getByTestId } = render(<LanguageSettingsScreen />);
    fireEvent.press(getByTestId("list-item-English"));
    expect(mockBack).toHaveBeenCalled();
    expect(mockSetLanguage).not.toHaveBeenCalled();
  });

  it("selecting different language calls setLanguage and navigates back", async () => {
    mockSetLanguage.mockResolvedValue(undefined);

    const { getByTestId } = render(<LanguageSettingsScreen />);
    fireEvent.press(getByTestId("list-item-French"));

    await waitFor(() => {
      expect(mockSetLanguage).toHaveBeenCalledWith({
        code: "fr",
        name: "French",
      });
      expect(mockBack).toHaveBeenCalled();
    });
  });

  it("renders FlagIcon for each language", () => {
    const { getByTestId } = render(<LanguageSettingsScreen />);
    expect(getByTestId("flag-icon-flag_en")).toBeTruthy();
    expect(getByTestId("flag-icon-flag_es")).toBeTruthy();
    expect(getByTestId("flag-icon-flag_fr")).toBeTruthy();
  });

  it("handles error when setLanguage fails", async () => {
    const { logError } = require("@/utils");
    mockSetLanguage.mockRejectedValue(new Error("language error"));

    const { getByTestId } = render(<LanguageSettingsScreen />);
    fireEvent.press(getByTestId("list-item-Spanish"));

    await waitFor(() => {
      expect(logError).toHaveBeenCalled();
    });
  });

  it("shows pending language as selected while saving", async () => {
    let resolveSetLanguage: () => void;
    mockSetLanguage.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSetLanguage = resolve;
        }),
    );

    const { getByTestId } = render(<LanguageSettingsScreen />);
    fireEvent.press(getByTestId("list-item-Spanish"));

    // While saving, Spanish should appear selected (pendingLanguageCode)
    await waitFor(() => {
      expect(getByTestId("radio-selected-es")).toHaveTextContent("selected");
    });

    resolveSetLanguage!();
    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled();
    });
  });

  it("does not call handleSelect when isSaving is true", async () => {
    mockSetLanguage.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 5000)),
    );

    const { getByTestId } = render(<LanguageSettingsScreen />);

    // First press starts saving
    fireEvent.press(getByTestId("list-item-Spanish"));

    // Second press while saving should be ignored
    fireEvent.press(getByTestId("list-item-French"));

    await waitFor(() => {
      expect(mockSetLanguage).toHaveBeenCalledTimes(1);
      expect(mockSetLanguage).toHaveBeenCalledWith({
        code: "es",
        name: "Spanish",
      });
    });
  });

  it("renders dividers between language items", () => {
    const { getAllByTestId } = render(<LanguageSettingsScreen />);
    // 3 languages, dividers between them = 2 dividers
    const dividers = getAllByTestId("divider");
    expect(dividers).toHaveLength(2);
  });

  it("Radio onValueChange triggers handleSelect for Spanish", async () => {
    mockSetLanguage.mockResolvedValue(undefined);

    const { getByTestId } = render(<LanguageSettingsScreen />);
    fireEvent.press(getByTestId("radio-es"));

    await waitFor(() => {
      expect(mockSetLanguage).toHaveBeenCalledWith({
        code: "es",
        name: "Spanish",
      });
    });
  });
});
