/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { Routes } from "@/constants";

import TryLargerModel from "./try-larger-model";

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

const mockEnsure = jest.fn();
jest.mock("@/hooks", () => ({
  useEnsureModelDownloaded: () => mockEnsure,
}));

const mockLogError = jest.fn();
jest.mock("@/utils", () => ({
  FeatureFlag: { settings: "settings" },
  logError: (...args: unknown[]) => mockLogError(...args),
}));

const mockSetModelId = jest.fn();
const mockCancel = jest.fn();
let mockLanguageCode = "de";
let mockIsDownloaded = false;
let mockStatus: string | undefined;
jest.mock("@/stores", () => ({
  useSelectedLanguage: () => ({ code: mockLanguageCode, name: "x" }),
  useIsModelDownloaded: () => mockIsDownloaded,
  useModelDownloadProgress: () => undefined,
  useModelDownloadStore: Object.assign(
    (selector: (s: { cancelDownload: typeof mockCancel }) => unknown) =>
      selector({ cancelDownload: mockCancel }),
    {
      getState: () => ({
        cancelDownload: mockCancel,
        getProgress: () => (mockStatus ? { status: mockStatus } : undefined),
      }),
    },
  ),
  useSelectedModelId: () => "whisper_tiny",
  useSetModelId: () => mockSetModelId,
}));

jest.mock("@/components", () => {
  const { TouchableOpacity, Text, View } = require("react-native");
  return {
    TryLargerModelScreen: (props: {
      model: { id: string };
      onDownload: () => void;
      onCancelDownload: () => void;
      onSelect: () => void;
      onBack: () => void;
      onNext: () => void;
    }) => (
      <View>
        <Text testID="model">{props.model.id}</Text>
        <TouchableOpacity testID="download" onPress={props.onDownload} />
        <TouchableOpacity testID="cancel" onPress={props.onCancelDownload} />
        <TouchableOpacity testID="select" onPress={props.onSelect} />
        <TouchableOpacity testID="back" onPress={props.onBack} />
        <TouchableOpacity testID="next" onPress={props.onNext} />
      </View>
    ),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguageCode = "de";
  mockIsDownloaded = false;
  mockStatus = undefined;
  mockSetModelId.mockResolvedValue(undefined);
});

describe("TryLargerModel onboarding route", () => {
  it("recommends a model for the selected language", () => {
    const { getByTestId, rerender } = render(<TryLargerModel />);
    expect(getByTestId("model").props.children).toBe("nemo_parakeet_v3");
    mockLanguageCode = "ja";
    rerender(<TryLargerModel />);
    expect(getByTestId("model").props.children).toBe("whisper_small");
  });

  it("selects the model after a successful download", async () => {
    mockEnsure.mockResolvedValue(true);
    const { getByTestId } = render(<TryLargerModel />);
    await act(async () => {
      fireEvent.press(getByTestId("download"));
    });
    expect(mockEnsure).toHaveBeenCalledWith("nemo_parakeet_v3");
    expect(mockSetModelId).toHaveBeenCalledWith("nemo_parakeet_v3");
  });

  it("does not select when the download fails", async () => {
    mockEnsure.mockResolvedValue(false);
    const { getByTestId } = render(<TryLargerModel />);
    await act(async () => {
      fireEvent.press(getByTestId("download"));
    });
    expect(mockSetModelId).not.toHaveBeenCalled();
  });

  it("logs a failed selection", async () => {
    mockSetModelId.mockRejectedValue(new Error("boom"));
    const { getByTestId } = render(<TryLargerModel />);
    await act(async () => {
      fireEvent.press(getByTestId("select"));
    });
    expect(mockLogError).toHaveBeenCalledTimes(1);
  });

  it("wires cancel, back and next", async () => {
    const { getByTestId } = render(<TryLargerModel />);
    fireEvent.press(getByTestId("cancel"));
    fireEvent.press(getByTestId("back"));
    await act(async () => {
      fireEvent.press(getByTestId("next"));
    });
    expect(mockCancel).toHaveBeenCalledWith("nemo_parakeet_v3");
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockSetModelId).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(Routes.onboardingTutorialIntro);
  });

  it("cancels an in-flight download when leaving", async () => {
    mockStatus = "downloading";
    const { getByTestId, unmount } = render(<TryLargerModel />);
    await act(async () => {
      fireEvent.press(getByTestId("next"));
    });
    expect(mockCancel).toHaveBeenCalledTimes(1);
    unmount();
    expect(mockCancel).toHaveBeenCalledTimes(2);
  });

  it("leaves a finished download alone on unmount", () => {
    mockStatus = "completed";
    render(<TryLargerModel />).unmount();
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("selects a downloaded but unselected model on next", async () => {
    mockIsDownloaded = true;
    const { getByTestId } = render(<TryLargerModel />);
    await act(async () => {
      fireEvent.press(getByTestId("next"));
    });
    expect(mockSetModelId).toHaveBeenCalledWith("nemo_parakeet_v3");
    expect(mockPush).toHaveBeenCalledWith(Routes.onboardingTutorialIntro);
  });
});
