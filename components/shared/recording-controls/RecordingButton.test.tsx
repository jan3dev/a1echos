/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { TranscriptionState } from "@/models";

import { RecordingButton } from "./RecordingButton";

jest.mock("../../ui/icon/Icon", () => ({
  Icon: ({ name, ...rest }: { name: string; [key: string]: unknown }) => {
    const { View } = require("react-native");
    return <View testID={`icon-${name}`} {...rest} />;
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

describe("RecordingButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with "Start Recording" accessibility label in READY state', () => {
    const { getByLabelText } = render(
      <RecordingButton state={TranscriptionState.READY} colors={mockColors} />,
    );
    expect(getByLabelText("Start Recording")).toBeTruthy();
  });

  it('renders with "Stop Recording" accessibility label in RECORDING state', () => {
    const { getByLabelText } = render(
      <RecordingButton
        state={TranscriptionState.RECORDING}
        colors={mockColors}
      />,
    );
    expect(getByLabelText("Stop Recording")).toBeTruthy();
  });

  it('renders with "Transcribing" accessibility label in TRANSCRIBING state', () => {
    const { getByLabelText } = render(
      <RecordingButton
        state={TranscriptionState.TRANSCRIBING}
        colors={mockColors}
      />,
    );
    expect(getByLabelText("Transcribing")).toBeTruthy();
  });

  it("pressing start triggers onRecordingStart callback and haptic feedback", () => {
    const Haptics = require("expo-haptics");
    const onRecordingStart = jest.fn();
    const { getByLabelText } = render(
      <RecordingButton
        state={TranscriptionState.READY}
        onRecordingStart={onRecordingStart}
        colors={mockColors}
      />,
    );
    fireEvent.press(getByLabelText("Start Recording"));
    expect(onRecordingStart).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Medium,
    );
  });

  it("pressing stop triggers haptic feedback", () => {
    const Haptics = require("expo-haptics");
    const onRecordingStop = jest.fn();
    const { getByLabelText } = render(
      <RecordingButton
        state={TranscriptionState.RECORDING}
        onRecordingStop={onRecordingStop}
        colors={mockColors}
      />,
    );
    fireEvent.press(getByLabelText("Stop Recording"));
    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light,
    );
  });

  it("disabled button does not fire callbacks", () => {
    const onRecordingStart = jest.fn();
    const { getByLabelText } = render(
      <RecordingButton
        state={TranscriptionState.READY}
        onRecordingStart={onRecordingStart}
        enabled={false}
        colors={mockColors}
      />,
    );
    fireEvent.press(getByLabelText("Start Recording"));
    expect(onRecordingStart).not.toHaveBeenCalled();
  });
});
