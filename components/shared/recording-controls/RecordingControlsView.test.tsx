/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";
import { TranscriptionState } from "@/models";

import { RecordingControlsView } from "./RecordingControlsView";

jest.mock("./RecordingButton", () => ({
  RecordingButton: (props: any) => {
    const { View } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return <View testID={TID.RecordingButton} {...props} />;
  },
}));

jest.mock("./ThreeWaveLines", () => ({
  ThreeWaveLines: (props: any) => {
    const { View } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return <View testID={TID.ThreeWaveLines} {...props} />;
  },
}));

const mockColors = {
  accentBrand: "#6366F1",
  glassInverse: "rgba(0,0,0,0.1)",
  textInverse: "#FFFFFF",
  textPrimary: "#000000",
  textTertiary: "#999999",
  surfacePrimary: "#FFFFFF",
} as any;

describe("RecordingControlsView", () => {
  it("renders without crashing", () => {
    const { toJSON } = render(<RecordingControlsView colors={mockColors} />);
    expect(toJSON()).toBeTruthy();
  });

  it("renders RecordingButton", () => {
    const { getByTestId } = render(
      <RecordingControlsView colors={mockColors} />,
    );
    expect(getByTestId(TestID.RecordingButton)).toBeTruthy();
  });

  it("renders ThreeWaveLines while RECORDING", () => {
    const { getByTestId } = render(
      <RecordingControlsView
        state={TranscriptionState.RECORDING}
        colors={mockColors}
      />,
    );
    expect(getByTestId(TestID.ThreeWaveLines)).toBeTruthy();
  });

  it("renders ThreeWaveLines while STREAMING", () => {
    const { getByTestId } = render(
      <RecordingControlsView
        state={TranscriptionState.STREAMING}
        colors={mockColors}
      />,
    );
    expect(getByTestId(TestID.ThreeWaveLines)).toBeTruthy();
  });

  it("does not render ThreeWaveLines in READY state", () => {
    const { queryByTestId } = render(
      <RecordingControlsView
        state={TranscriptionState.READY}
        colors={mockColors}
      />,
    );
    expect(queryByTestId(TestID.ThreeWaveLines)).toBeNull();
  });

  it("does not render ThreeWaveLines in TRANSCRIBING state", () => {
    const { queryByTestId } = render(
      <RecordingControlsView
        state={TranscriptionState.TRANSCRIBING}
        colors={mockColors}
      />,
    );
    expect(queryByTestId(TestID.ThreeWaveLines)).toBeNull();
  });

  it("does not render ThreeWaveLines in LOADING state", () => {
    const { queryByTestId } = render(
      <RecordingControlsView
        state={TranscriptionState.LOADING}
        colors={mockColors}
      />,
    );
    expect(queryByTestId(TestID.ThreeWaveLines)).toBeNull();
  });

  it("passes state prop to RecordingButton", () => {
    const { getByTestId } = render(
      <RecordingControlsView
        state={TranscriptionState.RECORDING}
        colors={mockColors}
      />,
    );
    expect(getByTestId(TestID.RecordingButton).props.state).toBe(
      TranscriptionState.RECORDING,
    );
  });
});
