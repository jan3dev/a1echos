/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";

import SpokenLanguageOnboarding from "./spoken-language";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
}));

const mockSetLanguage = jest.fn();
jest.mock("@/stores", () => ({
  useSelectedLanguage: () => ({ code: "en", name: "English" }),
  useSelectedModelId: () => "whisper-tiny",
  useSetLanguage: () => mockSetLanguage,
}));

jest.mock("@/models", () => ({
  getModelInfo: () => ({ supportedLanguageCodes: ["en", "pt"] }),
  SupportedLanguages: {
    forCodes: () => [
      { code: "en", name: "English" },
      { code: "pt", name: "Portuguese" },
    ],
  },
}));

const mockFinishOnboarding = jest.fn();
const mockConfirmSkip = jest.fn();
jest.mock("@/hooks", () => ({
  useOnboardingExit: () => ({
    finishOnboarding: mockFinishOnboarding,
    confirmSkip: mockConfirmSkip,
  }),
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

  it("finishes without saving when the language is unchanged", async () => {
    const { getByTestId } = render(<SpokenLanguageOnboarding />);
    await act(async () => {
      fireEvent.press(getByTestId("next"));
    });
    expect(mockSetLanguage).not.toHaveBeenCalled();
    expect(mockFinishOnboarding).toHaveBeenCalledTimes(1);
  });

  it("saves the picked language on next", async () => {
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
    expect(mockFinishOnboarding).toHaveBeenCalledTimes(1);
  });

  it("still finishes when saving fails", async () => {
    mockSetLanguage.mockRejectedValue(new Error("boom"));
    const { getByTestId } = render(<SpokenLanguageOnboarding />);
    fireEvent.press(getByTestId("lang-pt"));
    await act(async () => {
      fireEvent.press(getByTestId("next"));
    });
    expect(mockFinishOnboarding).toHaveBeenCalledTimes(1);
  });
});
