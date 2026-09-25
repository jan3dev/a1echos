/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { Routes } from "@/constants";

import SpokenLanguageOnboarding from "./spoken-language";

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

const mockSetLanguage = jest.fn();
const mockMarkSuggestionSeen = jest.fn();
let mockModelId = "whisper_tiny";
jest.mock("@/stores", () => ({
  useSelectedLanguage: () => ({ code: "en", name: "English" }),
  useSelectedModelId: () => mockModelId,
  useSetLanguage: () => mockSetLanguage,
  useMarkLargerModelSuggestionSeen: () => mockMarkSuggestionSeen,
}));

jest.mock("@/models", () => ({
  getModelInfo: () => ({ supportedLanguageCodes: ["en", "pt"] }),
  ModelId: { WHISPER_TINY: "whisper_tiny" },
  shouldSuggestLargerModel: jest.requireActual(
    "@/models/model-registry/ModelRegistry",
  ).shouldSuggestLargerModel,
  SupportedLanguages: {
    defaultLanguage: { code: "en", name: "English" },
    forCodes: () => [
      { code: "en", name: "English" },
      { code: "pt", name: "Portuguese" },
    ],
  },
}));

const mockConfirmSkip = jest.fn();
jest.mock("@/hooks", () => ({
  useOnboardingExit: () => ({ confirmSkip: mockConfirmSkip }),
}));

jest.mock("@/components", () => {
  const { TouchableOpacity, Text, View } = require("react-native");
  return {
    SpokenLanguageScreen: ({
      languages,
      selectedCode,
      onSelect,
      onBack,
      onSkip,
      onNext,
    }: {
      languages: { code: string; name: string }[];
      selectedCode: string;
      onSelect: (l: { code: string; name: string }) => void;
      onBack: () => void;
      onSkip: () => void;
      onNext: () => void;
    }) => (
      <View>
        <Text testID="selected">{selectedCode}</Text>
        {languages.map((l) => (
          <TouchableOpacity
            key={l.code}
            testID={`lang-${l.code}`}
            onPress={() => onSelect(l)}
          />
        ))}
        <TouchableOpacity testID="back" onPress={onBack} />
        <TouchableOpacity testID="skip" onPress={onSkip} />
        <TouchableOpacity testID="next" onPress={onNext} />
      </View>
    ),
    Toast: () => null,
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockModelId = "whisper_tiny";
  mockSetLanguage.mockResolvedValue(undefined);
});

describe("SpokenLanguage onboarding route", () => {
  it("wires back and skip", () => {
    const { getByTestId } = render(<SpokenLanguageOnboarding />);
    fireEvent.press(getByTestId("back"));
    fireEvent.press(getByTestId("skip"));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockConfirmSkip).toHaveBeenCalledTimes(1);
  });

  it("goes to the tutorial without saving when English is unchanged", async () => {
    const { getByTestId } = render(<SpokenLanguageOnboarding />);
    await act(async () => {
      fireEvent.press(getByTestId("next"));
    });
    expect(mockSetLanguage).not.toHaveBeenCalled();
    expect(mockMarkSuggestionSeen).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(Routes.onboardingTutorialIntro);
  });

  it("saves a non-English pick and offers a larger model", async () => {
    const { getByTestId } = render(<SpokenLanguageOnboarding />);
    fireEvent.press(getByTestId("lang-pt"));
    expect(getByTestId("selected").props.children).toBe("pt");
    await act(async () => {
      fireEvent.press(getByTestId("next"));
    });
    expect(mockSetLanguage).toHaveBeenCalledWith({
      code: "pt",
      name: "Portuguese",
    });
    expect(mockMarkSuggestionSeen).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(Routes.onboardingTryLargerModel);
  });

  it("skips the larger-model offer when already off the bundled model", async () => {
    mockModelId = "nemo_parakeet_v3";
    const { getByTestId } = render(<SpokenLanguageOnboarding />);
    fireEvent.press(getByTestId("lang-pt"));
    await act(async () => {
      fireEvent.press(getByTestId("next"));
    });
    expect(mockPush).toHaveBeenCalledWith(Routes.onboardingTutorialIntro);
  });

  it("goes to the tutorial when saving fails", async () => {
    mockSetLanguage.mockRejectedValue(new Error("boom"));
    const { getByTestId } = render(<SpokenLanguageOnboarding />);
    fireEvent.press(getByTestId("lang-pt"));
    await act(async () => {
      fireEvent.press(getByTestId("next"));
    });
    expect(mockPush).toHaveBeenCalledWith(Routes.onboardingTutorialIntro);
  });
});
