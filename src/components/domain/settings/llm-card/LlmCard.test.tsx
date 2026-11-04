import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import type { DownloadProgress } from "@/services";
import type { AquaColors } from "@/theme";

import { LlmCard } from "./LlmCard";

jest.mock("@/theme", () => ({
  ...jest.requireActual("@/theme"),
  useTheme: jest.fn(() => ({
    theme: {
      colors: {
        surfacePrimary: "#111",
        surfaceBorderPrimary: "#222",
        surfaceBorderSelected: "#33f",
        textPrimary: "#fff",
        textSecondary: "#aaa",
        textTertiary: "#888",
        accentBrand: "#57f",
        accentDanger: "#f33",
        accentWarning: "#fa1",
        ripple: "#222",
      },
      typography: new Proxy(
        {},
        { get: () => ({ fontFamily: "Inter", fontSize: 12 }) },
      ),
    },
  })),
  getShadow: jest.fn(() => ({})),
}));

jest.mock("@/utils", () => ({
  iosPressed: jest.fn(() => 1),
  formatBytes: jest.fn((bytes: number) => `${Math.round(bytes / 1e6)} MB`),
}));

jest.mock("@/hooks", () => ({
  useLocalization: jest.fn(() => ({
    loc: new Proxy({}, { get: (_, p) => p }),
  })),
}));

const progress = (
  status: DownloadProgress["status"],
  ratio = 0,
): DownloadProgress => ({
  modelId: "qwen35_2b" as DownloadProgress["modelId"],
  totalBytes: 250_000_000,
  downloadedBytes: 250_000_000 * ratio,
  progressRatio: ratio,
  status,
  currentFileIndex: 0,
  totalFiles: 1,
});

const baseProps = {
  name: "Qwen3.5 2B",
  description: "Balanced quality and speed",
  sizeLabel: "1.3 GB",
  isSelected: false,
  isDownloaded: false,
};

describe("LlmCard", () => {
  it("shows a warning only when given one", () => {
    const { getByText, rerender, queryByText } = render(
      <LlmCard {...baseProps} warning="English only" />,
    );
    expect(getByText("English only")).toBeTruthy();
    rerender(<LlmCard {...baseProps} />);
    expect(queryByText("English only")).toBeNull();
  });

  it("offers a download with capabilities when not downloaded", () => {
    const onDownload = jest.fn();
    const { getByText, queryByText } = render(
      <LlmCard {...baseProps} onDownload={onDownload} />,
    );
    expect(getByText("llmCapabilitySummarization")).toBeTruthy();
    expect(getByText("llmCapabilityTextCleanup")).toBeTruthy();
    expect(getByText("1.3 GB")).toBeTruthy();
    expect(queryByText("delete")).toBeNull();
    fireEvent.press(getByText("download"));
    expect(onDownload).toHaveBeenCalled();
  });

  it("shows progress and cancels while downloading", () => {
    const onCancel = jest.fn();
    const { getByText } = render(
      <LlmCard
        {...baseProps}
        downloadProgress={progress("downloading", 0.75)}
        onCancelDownload={onCancel}
      />,
    );
    expect(getByText("75%")).toBeTruthy();
    expect(getByText("188 MB / 250 MB")).toBeTruthy();
    fireEvent.press(getByText("cancel"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("offers a retry after a failed download", () => {
    const onRetry = jest.fn();
    const { getByText } = render(
      <LlmCard
        {...baseProps}
        downloadProgress={progress("error")}
        onRetry={onRetry}
      />,
    );
    expect(getByText("downloadFailed")).toBeTruthy();
    fireEvent.press(getByText("tryAgain"));
    expect(onRetry).toHaveBeenCalled();
  });

  it("selects and deletes once downloaded", () => {
    const onSelect = jest.fn();
    const onDelete = jest.fn();
    const { getByText, getByTestId } = render(
      <LlmCard
        {...baseProps}
        testID="card"
        isDownloaded
        onSelect={onSelect}
        onDelete={onDelete}
      />,
    );
    expect(getByText("llmCapabilitiesSummary")).toBeTruthy();
    fireEvent.press(getByTestId("card"));
    expect(onSelect).toHaveBeenCalled();
    fireEvent.press(getByText("delete"));
    expect(onDelete).toHaveBeenCalled();
  });

  it("badges the recommended model and blocks selection when disabled", () => {
    const onSelect = jest.fn();
    const { getByText, getByTestId } = render(
      <LlmCard
        {...baseProps}
        testID="card"
        isRecommended
        isDownloaded
        disabled
        onSelect={onSelect}
        colors={{ textPrimary: "#000" } as AquaColors}
      />,
    );
    expect(getByText("recommended")).toBeTruthy();
    fireEvent.press(getByTestId("card"));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
