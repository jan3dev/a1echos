import { render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";

import { LiveTranscriptionView } from "./LiveTranscriptionView";

jest.mock("../transcription-list/TranscriptionList", () => ({
  TranscriptionList: (props: any) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View } = require("react-native");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TestID: TID } = require("@/constants");
    return <View testID={TID.TranscriptionList} {...props} />;
  },
}));

describe("LiveTranscriptionView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders TranscriptionList with selectionMode=false", () => {
    const { getByTestId } = render(<LiveTranscriptionView />);
    const list = getByTestId(TestID.TranscriptionList);
    expect(list.props.selectionMode).toBe(false);
  });

  it("passes default padding values", () => {
    const { getByTestId } = render(<LiveTranscriptionView />);
    const list = getByTestId(TestID.TranscriptionList);
    expect(list.props.topPadding).toBe(0);
    expect(list.props.bottomPadding).toBe(16.0);
  });

  it("custom padding props forwarded", () => {
    const { getByTestId } = render(
      <LiveTranscriptionView topPadding={20} bottomPadding={40} />,
    );
    const list = getByTestId(TestID.TranscriptionList);
    expect(list.props.topPadding).toBe(20);
    expect(list.props.bottomPadding).toBe(40);
  });

  it("passes empty Set for selectedTranscriptionIds", () => {
    const { getByTestId } = render(<LiveTranscriptionView />);
    const list = getByTestId(TestID.TranscriptionList);
    expect(list.props.selectedTranscriptionIds).toEqual(new Set());
  });

  it("passes noop handlers for tap and long press", () => {
    const { getByTestId } = render(<LiveTranscriptionView />);
    const list = getByTestId(TestID.TranscriptionList);
    expect(typeof list.props.onTranscriptionTap).toBe("function");
    expect(typeof list.props.onTranscriptionLongPress).toBe("function");
    // Ensure they don't throw when called
    expect(() => list.props.onTranscriptionTap()).not.toThrow();
    expect(() => list.props.onTranscriptionLongPress()).not.toThrow();
  });

  it("forwards listRef to TranscriptionList", () => {
    const ref = { current: null } as any;
    const { getByTestId } = render(<LiveTranscriptionView listRef={ref} />);
    const list = getByTestId(TestID.TranscriptionList);
    expect(list.props.listRef).toBe(ref);
  });

  it("renders container structure", () => {
    const { getByTestId } = render(<LiveTranscriptionView />);
    expect(getByTestId(TestID.TranscriptionList)).toBeTruthy();
  });
});
