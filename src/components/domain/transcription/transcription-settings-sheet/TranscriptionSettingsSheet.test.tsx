/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Platform, Text } from "react-native";

import { dynamicTestID, TestID } from "@/constants";
import { TranscriptionMode } from "@/models";

import { TranscriptionSettingsSheet } from "./TranscriptionSettingsSheet";

const mockSetLanguage = jest.fn().mockResolvedValue(undefined);
const mockSetTranscriptionMode = jest.fn().mockResolvedValue(undefined);
const mockShowLargerModelSuggestion = jest.fn();
const mockHasSeenSuggestion = jest.fn(() => true);

jest.mock("@/stores", () => ({
  useSelectedModelId: () => "whisper_tiny",
  useSelectedTranscriptionMode: () => "realtime",
  useSetTranscriptionMode: () => mockSetTranscriptionMode,
  useSelectedLanguage: () => ({ code: "en", name: "English" }),
  useSetLanguage: () => mockSetLanguage,
  useHasSeenLargerModelSuggestion: () => mockHasSeenSuggestion(),
  useShowLargerModelSuggestion: () => mockShowLargerModelSuggestion,
}));

jest.mock("@/hooks", () => ({
  useLocalization: () => ({
    loc: new Proxy({}, { get: (_, key) => String(key) }),
  }),
}));

const spanish = { code: "es", name: "Spanish" };

const renderSheet = (props = {}) =>
  render(
    <TranscriptionSettingsSheet
      visible
      onDismiss={jest.fn()}
      footer={<Text>footer</Text>}
      {...props}
    />,
  );

describe("TranscriptionSettingsSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasSeenSuggestion.mockReturnValue(true);
  });

  it("renders mode, language row and footer", () => {
    const { getByText, getByTestId } = renderSheet();
    expect(getByText("transcriptionModeTitle")).toBeTruthy();
    expect(getByText("realtime")).toBeTruthy();
    expect(getByText("highAccuracy")).toBeTruthy();
    expect(getByTestId(TestID.TranscriptionSettingsLanguage)).toBeTruthy();
    expect(getByText("footer")).toBeTruthy();
  });

  it("selecting a mode saves it", async () => {
    const { getByText } = renderSheet();
    await act(async () => {
      fireEvent.press(getByText("highAccuracy"));
    });
    expect(mockSetTranscriptionMode).toHaveBeenCalledWith(
      TranscriptionMode.FILE,
    );
  });

  it("swallows mode save failures (the store logs them)", async () => {
    mockSetTranscriptionMode.mockRejectedValueOnce(new Error("disk full"));
    const { getByText } = renderSheet();
    await act(async () => {
      fireEvent.press(getByText("highAccuracy"));
    });
    expect(getByText("footer")).toBeTruthy();
  });

  it("language row opens the language page, back returns", () => {
    const { getByTestId, queryByText, getByText } = renderSheet();
    fireEvent.press(getByTestId(TestID.TranscriptionSettingsLanguage));
    expect(getByTestId(dynamicTestID.language("es"))).toBeTruthy();
    expect(queryByText("footer")).toBeNull();

    fireEvent.press(getByTestId(TestID.TranscriptionSettingsBack));
    expect(getByText("footer")).toBeTruthy();
  });

  it("picking a language saves it and returns to the main page", async () => {
    const { getByTestId, getByText } = renderSheet();
    fireEvent.press(getByTestId(TestID.TranscriptionSettingsLanguage));
    await act(async () => {
      fireEvent.press(getByTestId(dynamicTestID.language("es")));
    });
    expect(mockSetLanguage).toHaveBeenCalledWith(
      expect.objectContaining(spanish),
    );
    expect(getByText("footer")).toBeTruthy();
  });

  it("re-picking the current language returns without saving", () => {
    const { getByTestId, getByText } = renderSheet();
    fireEvent.press(getByTestId(TestID.TranscriptionSettingsLanguage));
    fireEvent.press(getByTestId(dynamicTestID.language("en")));
    expect(mockSetLanguage).not.toHaveBeenCalled();
    expect(getByText("footer")).toBeTruthy();
  });

  it("ignores taps while a language save is in flight", async () => {
    const { getByTestId } = renderSheet();
    fireEvent.press(getByTestId(TestID.TranscriptionSettingsLanguage));
    await act(async () => {
      fireEvent.press(getByTestId(dynamicTestID.language("es")));
      fireEvent.press(getByTestId(dynamicTestID.language("fr")));
    });
    expect(mockSetLanguage).toHaveBeenCalledTimes(1);
  });

  it("stays on the language page when saving fails", async () => {
    mockSetLanguage.mockRejectedValueOnce(new Error("disk full"));
    const { getByTestId } = renderSheet();
    fireEvent.press(getByTestId(TestID.TranscriptionSettingsLanguage));
    await act(async () => {
      fireEvent.press(getByTestId(dynamicTestID.language("es")));
    });
    expect(getByTestId(dynamicTestID.language("es"))).toBeTruthy();
  });

  it("dismisses before nudging toward a larger model", async () => {
    mockHasSeenSuggestion.mockReturnValue(false);
    const onDismiss = jest.fn();
    const { getByTestId, UNSAFE_getByType } = renderSheet({ onDismiss });
    fireEvent.press(getByTestId(TestID.TranscriptionSettingsLanguage));
    await act(async () => {
      fireEvent.press(getByTestId(dynamicTestID.language("es")));
    });
    expect(onDismiss).toHaveBeenCalled();

    const { Modal } = require("react-native");
    if (Platform.OS === "ios") {
      expect(mockShowLargerModelSuggestion).not.toHaveBeenCalled();
      act(() => UNSAFE_getByType(Modal).props.onDismiss());
    }
    expect(mockShowLargerModelSuggestion).toHaveBeenCalled();
  });

  it("back button on the language page returns instead of closing", () => {
    const onDismiss = jest.fn();
    const { getByTestId, UNSAFE_getByType, getByText } = renderSheet({
      onDismiss,
    });
    const { Modal } = require("react-native");
    fireEvent.press(getByTestId(TestID.TranscriptionSettingsLanguage));
    act(() => UNSAFE_getByType(Modal).props.onRequestClose());
    expect(onDismiss).not.toHaveBeenCalled();
    expect(getByText("footer")).toBeTruthy();

    act(() => UNSAFE_getByType(Modal).props.onRequestClose());
    expect(onDismiss).toHaveBeenCalled();
  });
});
