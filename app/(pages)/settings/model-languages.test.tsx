/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";
import React from "react";

import ModelLanguagesScreen from "./model-languages";

const mockParams: { modelId?: string } = {};
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
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

jest.mock("@/hooks", () => ({
  useLocalization: jest.fn(() => ({
    loc: {
      languagesSupported: (count: number) => `languagesSupported_${count}`,
    },
  })),
}));

jest.mock("@/models", () => {
  const mockParakeet = {
    id: "nemo_parakeet_v3",
    name: "Parakeet V3",
    languages: 25,
    supportedLanguageCodes: ["en", "es", "fr"],
  };
  const mockWhisper = {
    id: "whisper_tiny",
    name: "Whisper Tiny",
    languages: 99,
    supportedLanguageCodes: undefined,
  };
  return {
    MODEL_REGISTRY: {
      whisper_tiny: { id: "whisper_tiny" },
      nemo_parakeet_v3: { id: "nemo_parakeet_v3" },
    },
    getModelInfo: jest.fn((id: string) =>
      id === "nemo_parakeet_v3" ? mockParakeet : mockWhisper,
    ),
    SupportedLanguages: {
      forCodes: jest.fn((codes?: string[]) =>
        codes
          ? codes.map((c) => ({ code: c, name: `Lang-${c}` }))
          : [
              { code: "en", name: "English" },
              { code: "ja", name: "Japanese" },
            ],
      ),
    },
    getCountryCode: jest.fn((lang: any) => `country_${lang.code}`),
  };
});

jest.mock("@/stores", () => ({
  useSelectedModelId: jest.fn(() => "whisper_tiny"),
}));

jest.mock("@/components", () => {
  const { View, Text } = require("react-native");
  return {
    FlagIcon: ({ name }: any) => <View testID={`flag-icon-${name}`} />,
    Text: ({ children }: any) => <Text>{String(children)}</Text>,
    TopAppBar: ({ title }: any) => (
      <View testID="top-app-bar">
        <Text>{String(title)}</Text>
      </View>
    ),
  };
});

jest.mock("@/utils", () => ({
  iosPressed: jest.fn(() => 1),
  logWarn: jest.fn(),
}));

describe("ModelLanguagesScreen", () => {
  beforeEach(() => {
    delete mockParams.modelId;
  });

  it("renders languages for the selected model when no param is passed", () => {
    const { getByText, getByTestId } = render(<ModelLanguagesScreen />);
    expect(getByText("Whisper Tiny")).toBeTruthy();
    // Whisper with no supportedLanguageCodes → forCodes returns 2 mock entries
    expect(getByText("languagesSupported_2")).toBeTruthy();
    expect(getByTestId("language-chip-en")).toBeTruthy();
    expect(getByTestId("language-chip-ja")).toBeTruthy();
  });

  it("honors the modelId param when valid", () => {
    mockParams.modelId = "nemo_parakeet_v3";
    const { getByText, getByTestId } = render(<ModelLanguagesScreen />);
    expect(getByText("Parakeet V3")).toBeTruthy();
    expect(getByTestId("language-chip-en")).toBeTruthy();
    expect(getByTestId("language-chip-fr")).toBeTruthy();
    expect(getByTestId("flag-icon-country_en")).toBeTruthy();
  });

  it("falls back to selected model when the modelId param is invalid", () => {
    mockParams.modelId = "not-a-model";
    const { getByText } = render(<ModelLanguagesScreen />);
    expect(getByText("Whisper Tiny")).toBeTruthy();
  });
});
