/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";
import { useTranscriptionStore } from "@/stores";

import { TranscriptionContentView } from "./TranscriptionContentView";

jest.mock("@/stores", () => ({
  useTranscriptionStore: jest.fn(),
}));

jest.mock("../transcription-list/TranscriptionList", () => ({
  TranscriptionList: (props: any) => {
    const { View } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return <View testID={TID.TranscriptionList} {...props} />;
  },
}));

jest.mock("../../../ui/progress/ProgressIndicator", () => ({
  ProgressIndicator: () => {
    const { View } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return <View testID={TID.ProgressIndicator} />;
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
    expect(getByTestId(TestID.ProgressIndicator)).toBeTruthy();
    expect(queryByTestId(TestID.TranscriptionList)).toBeNull();
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
    expect(queryByTestId(TestID.TranscriptionList)).toBeNull();
  });

  it("renders TranscriptionList in normal state", () => {
    (useTranscriptionStore as unknown as jest.Mock).mockReturnValue({
      isLoading: () => false,
      getError: () => null,
    });
    const { getByTestId, queryByTestId } = render(
      <TranscriptionContentView {...defaultProps} />,
    );
    expect(getByTestId(TestID.TranscriptionList)).toBeTruthy();
    expect(queryByTestId(TestID.ProgressIndicator)).toBeNull();
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
    const list = getByTestId(TestID.TranscriptionList);
    expect(list.props.selectionMode).toBe(true);
    expect(list.props.selectedTranscriptionIds).toBe(selectedIds);
  });
});
