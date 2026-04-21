import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { ModelId, TranscriptionMode } from "@/models";

import { ModelCard } from "./ModelCard";

jest.mock("@/theme", () => ({
  useTheme: jest.fn(() => ({
    theme: {
      colors: {
        surfacePrimary: "#111",
        surfaceBorderPrimary: "#222",
        surfaceBorderSelected: "#33f",
        surfaceTertiary: "#444",
        surfaceBorderSecondary: "#555",
        textPrimary: "#fff",
        textSecondary: "#aaa",
        textTertiary: "#888",
        accentBrand: "#57f",
        accentBrandTransparent: "rgba(67,97,238,0.16)",
        accentDanger: "#f33",
        accentWarning: "#fa1",
        ripple: "#222",
      },
      typography: new Proxy(
        {},
        {
          get: () => ({ fontFamily: "Inter", fontSize: 12 }),
        },
      ),
    },
  })),
  getShadow: jest.fn(() => ({})),
}));

jest.mock("@/utils", () => ({
  iosPressed: jest.fn(() => 1),
  logWarn: jest.fn(),
  FeatureFlag: { ui: "ui" },
  logError: jest.fn(),
  formatBytes: jest.fn((bytes: number) => {
    if (bytes >= 1_000_000_000)
      return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
    return `${Math.round(bytes / 1_000_000)} MB`;
  }),
}));

jest.mock("@/hooks", () => ({
  useLocalization: jest.fn(() => ({
    loc: {
      modelLanguageCount: (count: number) => `${count} languages`,
      modelIncluded: "Included",
      modelDownload: "Download",
      modelDelete: "Delete",
      modelCancel: "Cancel",
      modelTryAgain: "Try again",
      modelDownloadFailed: "Download failed",
      modelModeRealtime: "Real-time",
      modelModeHighAccuracy: "High Accuracy",
      modelModeRealtimeOnly: "Real-time Only",
      modelModeHighAccuracyOnly: "High Accuracy Only",
    },
  })),
}));

const baseProps = {
  name: "Whisper Tiny",
  description: "Fast, lightweight transcription",
  languageCount: 99,
  sizeLabel: "250 MB",
  supportedModes: [TranscriptionMode.FILE, TranscriptionMode.REALTIME],
};

describe("ModelCard", () => {
  it("renders name and description", () => {
    const { getByText } = render(
      <ModelCard {...baseProps} isBundled isSelected isDownloaded />,
    );
    expect(getByText("Whisper Tiny")).toBeTruthy();
    expect(getByText("Fast, lightweight transcription")).toBeTruthy();
  });

  it("renders Included tag when bundled", () => {
    const { getByText } = render(
      <ModelCard {...baseProps} isBundled isSelected isDownloaded />,
    );
    expect(getByText("Included")).toBeTruthy();
  });

  it("renders Delete action when downloaded and not selected and not bundled", () => {
    const onDelete = jest.fn();
    const { getByText } = render(
      <ModelCard
        {...baseProps}
        isBundled={false}
        isSelected={false}
        isDownloaded
        onDelete={onDelete}
      />,
    );
    fireEvent.press(getByText("Delete"));
    expect(onDelete).toHaveBeenCalled();
  });

  it("hides Delete when the non-bundled downloaded model is selected", () => {
    const { queryByText } = render(
      <ModelCard
        {...baseProps}
        isBundled={false}
        isSelected
        isDownloaded
        onDelete={jest.fn()}
      />,
    );
    expect(queryByText("Delete")).toBeNull();
  });

  it("renders Download action when not downloaded and not bundled", () => {
    const onDownload = jest.fn();
    const { getByText } = render(
      <ModelCard
        {...baseProps}
        isBundled={false}
        isSelected={false}
        isDownloaded={false}
        onDownload={onDownload}
      />,
    );
    fireEvent.press(getByText("Download"));
    expect(onDownload).toHaveBeenCalled();
  });

  it("renders download progress and cancel", () => {
    const onCancel = jest.fn();
    const { getByText } = render(
      <ModelCard
        {...baseProps}
        isBundled={false}
        isSelected={false}
        isDownloaded={false}
        onCancelDownload={onCancel}
        downloadProgress={{
          modelId: ModelId.WHISPER_TINY,
          totalBytes: 600_000_000,
          downloadedBytes: 480_000_000,
          progress: 0.8,
          status: "downloading",
          currentFileIndex: 0,
          totalFiles: 3,
        }}
      />,
    );
    expect(getByText("80%")).toBeTruthy();
    expect(getByText("480 MB / 600 MB")).toBeTruthy();
    fireEvent.press(getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("renders error state with Try again action", () => {
    const onRetry = jest.fn();
    const { getByText } = render(
      <ModelCard
        {...baseProps}
        isBundled={false}
        isSelected={false}
        isDownloaded={false}
        onRetry={onRetry}
        downloadProgress={{
          modelId: ModelId.WHISPER_TINY,
          totalBytes: 600_000_000,
          downloadedBytes: 0,
          progress: 0,
          status: "error",
          error: "boom",
          currentFileIndex: 0,
          totalFiles: 3,
        }}
      />,
    );
    expect(getByText("Download failed")).toBeTruthy();
    fireEvent.press(getByText("Try again"));
    expect(onRetry).toHaveBeenCalled();
  });

  it("calls onSelect when the downloaded card is tapped", () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(
      <ModelCard
        {...baseProps}
        testID="card"
        isBundled={false}
        isSelected={false}
        isDownloaded
        onSelect={onSelect}
        onDelete={jest.fn()}
      />,
    );
    fireEvent.press(getByTestId("card"));
    expect(onSelect).toHaveBeenCalled();
  });

  it("does not call onSelect when disabled", () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(
      <ModelCard
        {...baseProps}
        testID="card"
        isBundled={false}
        isSelected={false}
        isDownloaded
        disabled
        onSelect={onSelect}
      />,
    );
    fireEvent.press(getByTestId("card"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("calls onLanguagesPress when languages chip is tapped", () => {
    const onLanguagesPress = jest.fn();
    const { getByText } = render(
      <ModelCard
        {...baseProps}
        isBundled
        isSelected
        isDownloaded
        onLanguagesPress={onLanguagesPress}
      />,
    );
    fireEvent.press(getByText("99 languages"));
    expect(onLanguagesPress).toHaveBeenCalled();
  });

  it("shows size label for downloaded models (bundled and not)", () => {
    const { queryByText, rerender } = render(
      <ModelCard {...baseProps} isBundled isSelected isDownloaded />,
    );
    expect(queryByText("250 MB")).toBeTruthy();

    rerender(
      <ModelCard
        {...baseProps}
        isBundled={false}
        isSelected={false}
        isDownloaded
        onDelete={jest.fn()}
      />,
    );
    expect(queryByText("250 MB")).toBeTruthy();
  });

  it("renders two-chip mode selector for models supporting both modes", () => {
    const onSelectMode = jest.fn();
    const { getByText } = render(
      <ModelCard
        {...baseProps}
        isBundled
        isSelected
        isDownloaded
        selectedMode={TranscriptionMode.REALTIME}
        onSelectMode={onSelectMode}
      />,
    );
    expect(getByText("Real-time")).toBeTruthy();
    expect(getByText("High Accuracy")).toBeTruthy();

    fireEvent.press(getByText("High Accuracy"));
    expect(onSelectMode).toHaveBeenCalledWith(TranscriptionMode.FILE);
  });

  it("renders single 'Real-time Only' chip when model only supports realtime", () => {
    const { getByText } = render(
      <ModelCard
        {...baseProps}
        supportedModes={[TranscriptionMode.REALTIME]}
        isBundled={false}
        isSelected
        isDownloaded
      />,
    );
    expect(getByText("Real-time Only")).toBeTruthy();
  });

  it("renders single 'High Accuracy Only' chip when model only supports file mode", () => {
    const { getByText } = render(
      <ModelCard
        {...baseProps}
        supportedModes={[TranscriptionMode.FILE]}
        isBundled={false}
        isSelected
        isDownloaded
      />,
    );
    expect(getByText("High Accuracy Only")).toBeTruthy();
  });

  it("shows supported-mode meta inline when not downloaded", () => {
    const { getByText } = render(
      <ModelCard
        {...baseProps}
        supportedModes={[TranscriptionMode.FILE, TranscriptionMode.REALTIME]}
        isBundled={false}
        isSelected={false}
        isDownloaded={false}
        onDownload={jest.fn()}
      />,
    );
    expect(getByText("Real-time")).toBeTruthy();
    expect(getByText("High Accuracy")).toBeTruthy();
  });

  it("shows 'High Accuracy Only' meta inline when not downloaded and single-mode", () => {
    const { getByText } = render(
      <ModelCard
        {...baseProps}
        supportedModes={[TranscriptionMode.FILE]}
        isBundled={false}
        isSelected={false}
        isDownloaded={false}
        onDownload={jest.fn()}
      />,
    );
    expect(getByText("High Accuracy Only")).toBeTruthy();
  });
});
