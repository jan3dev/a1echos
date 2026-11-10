/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { dynamicTestID, Routes } from "@/constants";

import TranscriptionLanguageScreen from "./language";

const mockDismissTo = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "t1", language: "en" }),
  useRouter: () => ({ dismissTo: mockDismissTo }),
}));

const {
  mockMakeLoc,
} = require("../../../../src/test-utils/mock-localization/mockLocalization");

jest.mock("@/hooks", () => ({
  useScrollSurface: jest.fn(() => ({ scrolled: false, onScroll: jest.fn() })),
  useLocalization: jest.fn(() => ({ loc: mockMakeLoc() })),
}));

jest.mock("@/models", () => ({
  getModelInfo: () => ({ supportedLanguageCodes: ["en", "es"] }),
  SupportedLanguages: {
    forCodes: () => [
      { code: "en", name: "English" },
      { code: "es", name: "Spanish" },
    ],
  },
}));

jest.mock("@/stores", () => ({
  useSelectedModelId: () => "whisper_tiny",
}));

let mockSelected: string | undefined;
jest.mock("@/components", () => {
  const { Pressable, View } = require("react-native");
  const Pass = ({ children }: any) => <View>{children}</View>;
  return {
    AppBarBlurTarget: Pass,
    Screen: Pass,
    LanguageListItem: (props: any) => {
      if (props.selected) mockSelected = props.language.code;
      return (
        <Pressable
          testID={props.testID}
          onPress={() => props.onSelect(props.language)}
        />
      );
    },
    TopAppBar: () => null,
  };
});

describe("TranscriptionLanguageScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("marks the current language and returns the picked one to the editor", () => {
    const { getByTestId } = render(<TranscriptionLanguageScreen />);
    expect(mockSelected).toBe("en");

    fireEvent.press(getByTestId(dynamicTestID.language("es")));
    fireEvent.press(getByTestId(dynamicTestID.language("en")));

    expect(mockDismissTo).toHaveBeenNthCalledWith(
      1,
      Routes.transcriptionEdit("t1", "es"),
    );
    expect(mockDismissTo).toHaveBeenNthCalledWith(
      2,
      Routes.transcriptionEdit("t1", "en"),
    );
  });
});
