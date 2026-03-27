/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";
import React from "react";

import { useTranscriptionStore } from "@/stores";

import { TranscriptionContentView } from "./TranscriptionContentView";

jest.mock("@/stores", () => ({
  useTranscriptionStore: jest.fn(),
}));

jest.mock("./TranscriptionList", () => ({
  TranscriptionList: (props: any) => {
    const { View } = require("react-native");
    return <View testID="transcription-list" {...props} />;
  },
}));

jest.mock("../../ui/progress/ProgressIndicator", () => ({
  ProgressIndicator: () => {
    const { View } = require("react-native");
    return <View testID="progress-indicator" />;
  },
}));

const defaultProps = {
  selectionMode: false,
  selectedTranscriptionIds: new Set<string>(),
  onTranscriptionTap: jest.fn(),
  onTranscriptionLongPress: jest.fn(),
};

describe("TranscriptionContentView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows ProgressIndicator when loading", () => {
    (useTranscriptionStore as unknown as jest.Mock).mockReturnValue({
      isLoading: () => true,
      getError: () => null,
    });
    const { getByTestId, queryByTestId } = render(
      <TranscriptionContentView {...defaultProps} />,
    );
    expect(getByTestId("progress-indicator")).toBeTruthy();
    expect(queryByTestId("transcription-list")).toBeNull();
  });

  it("shows error text when error state", () => {
    (useTranscriptionStore as unknown as jest.Mock).mockReturnValue({
      isLoading: () => false,
      getError: () => "Something went wrong",
    });
    const { getByText, queryByTestId } = render(
      <TranscriptionContentView {...defaultProps} />,
    );
    expect(getByText("Something went wrong")).toBeTruthy();
    expect(queryByTestId("transcription-list")).toBeNull();
  });

  it("renders TranscriptionList in normal state", () => {
    (useTranscriptionStore as unknown as jest.Mock).mockReturnValue({
      isLoading: () => false,
      getError: () => null,
    });
    const { getByTestId, queryByTestId } = render(
      <TranscriptionContentView {...defaultProps} />,
    );
    expect(getByTestId("transcription-list")).toBeTruthy();
    expect(queryByTestId("progress-indicator")).toBeNull();
  });

  it("passes selection props through to TranscriptionList", () => {
    (useTranscriptionStore as unknown as jest.Mock).mockReturnValue({
      isLoading: () => false,
      getError: () => null,
    });
    const selectedIds = new Set(["t1", "t2"]);
    const { getByTestId } = render(
      <TranscriptionContentView
        {...defaultProps}
        selectionMode={true}
        selectedTranscriptionIds={selectedIds}
      />,
    );
    const list = getByTestId("transcription-list");
    expect(list.props.selectionMode).toBe(true);
    expect(list.props.selectedTranscriptionIds).toBe(selectedIds);
  });
});
