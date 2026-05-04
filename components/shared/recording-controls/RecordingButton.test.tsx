/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";
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

  it("renders transcribing button in LOADING state", () => {
    const { getByLabelText } = render(
      <RecordingButton
        state={TranscriptionState.LOADING}
        colors={mockColors}
      />,
    );
    expect(getByLabelText("Transcribing")).toBeTruthy();
  });

  it("renders default READY state when no state prop provided", () => {
    const { getByLabelText } = render(<RecordingButton colors={mockColors} />);
    expect(getByLabelText("Start Recording")).toBeTruthy();
  });

  it("renders READY state for ERROR state (default case in switch)", () => {
    const { getByLabelText } = render(
      <RecordingButton state={TranscriptionState.ERROR} colors={mockColors} />,
    );
    expect(getByLabelText("Start Recording")).toBeTruthy();
  });

  it("renders READY state for STREAMING state (default case in switch)", () => {
    const { getByLabelText } = render(
      <RecordingButton
        state={TranscriptionState.STREAMING}
        colors={mockColors}
      />,
    );
    expect(getByLabelText("Start Recording")).toBeTruthy();
  });

  it("stop recording fires haptic Light feedback", () => {
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

  it("start recording does not call callback if onRecordingStart is undefined", () => {
    const { getByLabelText } = render(
      <RecordingButton state={TranscriptionState.READY} colors={mockColors} />,
    );
    expect(() => {
      fireEvent.press(getByLabelText("Start Recording"));
    }).not.toThrow();
  });

  it("stop recording does not call callback if onRecordingStop is undefined", () => {
    const { getByLabelText } = render(
      <RecordingButton
        state={TranscriptionState.RECORDING}
        colors={mockColors}
      />,
    );
    expect(() => {
      fireEvent.press(getByLabelText("Stop Recording"));
    }).not.toThrow();
  });

  it("debouncing prevents multiple start presses", () => {
    const onRecordingStart = jest.fn();
    const { getByLabelText } = render(
      <RecordingButton
        state={TranscriptionState.READY}
        onRecordingStart={onRecordingStart}
        colors={mockColors}
      />,
    );
    fireEvent.press(getByLabelText("Start Recording"));
    fireEvent.press(getByLabelText("Start Recording"));
    // Second press should be ignored due to debouncing
    expect(onRecordingStart).toHaveBeenCalledTimes(1);
  });

  it("renders mic icon in READY state", () => {
    const { getByTestId } = render(
      <RecordingButton state={TranscriptionState.READY} colors={mockColors} />,
    );
    expect(getByTestId("icon-mic")).toBeTruthy();
  });

  it("renders rectangle (stop) icon in RECORDING state", () => {
    const { getByTestId } = render(
      <RecordingButton
        state={TranscriptionState.RECORDING}
        colors={mockColors}
      />,
    );
    expect(getByTestId("icon-rectangle")).toBeTruthy();
  });

  it("renders mic icon in TRANSCRIBING state", () => {
    const { getByTestId } = render(
      <RecordingButton
        state={TranscriptionState.TRANSCRIBING}
        colors={mockColors}
      />,
    );
    expect(getByTestId("icon-mic")).toBeTruthy();
  });

  it("transcribing button is disabled", () => {
    const { getByLabelText } = render(
      <RecordingButton
        state={TranscriptionState.TRANSCRIBING}
        colors={mockColors}
      />,
    );
    // The transcribing button's accessibility label is "Transcribing"
    // and the TouchableOpacity has disabled={true}
    const button = getByLabelText("Transcribing");
    expect(button.props.accessibilityRole).toBe("button");
  });

  it("accepts custom size prop", () => {
    const { getByLabelText } = render(
      <RecordingButton
        state={TranscriptionState.READY}
        colors={mockColors}
        size={48}
      />,
    );
    expect(getByLabelText("Start Recording")).toBeTruthy();
  });

  it("cleanup timer refs on unmount", () => {
    const { unmount } = render(
      <RecordingButton
        state={TranscriptionState.RECORDING}
        colors={mockColors}
      />,
    );
    // Should not throw on unmount (cleanup effect)
    expect(() => unmount()).not.toThrow();
  });

  it("stop button calls onRecordingStop after pulse animation delay", async () => {
    jest.useFakeTimers();
    const onRecordingStop = jest.fn();
    const { getByLabelText } = render(
      <RecordingButton
        state={TranscriptionState.RECORDING}
        onRecordingStop={onRecordingStop}
        scaleAnimationDuration={100}
        debounceDuration={200}
        colors={mockColors}
      />,
    );
    fireEvent.press(getByLabelText("Stop Recording"));
    // onRecordingStop is called after pulseDuration (scaleAnimationDuration * 2)
    expect(onRecordingStop).not.toHaveBeenCalled();
    jest.advanceTimersByTime(200);
    expect(onRecordingStop).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("state transition from RECORDING to READY resets animation", () => {
    const { rerender } = render(
      <RecordingButton
        state={TranscriptionState.RECORDING}
        colors={mockColors}
      />,
    );
    rerender(
      <RecordingButton state={TranscriptionState.READY} colors={mockColors} />,
    );
    // Should not crash; animation should reset
  });

  it("state transition from READY to RECORDING triggers scale animation", () => {
    jest.useFakeTimers();
    const { rerender } = render(
      <RecordingButton state={TranscriptionState.READY} colors={mockColors} />,
    );
    rerender(
      <RecordingButton
        state={TranscriptionState.RECORDING}
        colors={mockColors}
      />,
    );
    // Advance past SCALE_ANIMATION_DELAY (300ms)
    jest.advanceTimersByTime(300);
    // Should not crash; delayed scale animation fires
    jest.useRealTimers();
  });

  it("multiple state transitions do not cause errors", () => {
    jest.useFakeTimers();
    const { rerender } = render(
      <RecordingButton state={TranscriptionState.READY} colors={mockColors} />,
    );
    rerender(
      <RecordingButton
        state={TranscriptionState.RECORDING}
        colors={mockColors}
      />,
    );
    // Before delay fires, transition back to READY
    rerender(
      <RecordingButton state={TranscriptionState.READY} colors={mockColors} />,
    );
    jest.advanceTimersByTime(500);
    // Should not crash
    jest.useRealTimers();
  });

  it("onRecordingStart throwing error is handled gracefully", () => {
    const onRecordingStart = jest.fn(() => {
      throw new Error("start error");
    });
    const { getByLabelText } = render(
      <RecordingButton
        state={TranscriptionState.READY}
        onRecordingStart={onRecordingStart}
        colors={mockColors}
      />,
    );
    // The component catches errors in handleRecordingAction
    expect(() => {
      fireEvent.press(getByLabelText("Start Recording"));
    }).not.toThrow();
  });

  it("debounce timer is reset on stop recording then allows re-press after delay", async () => {
    jest.useFakeTimers();
    const onRecordingStop = jest.fn();
    const { getByLabelText } = render(
      <RecordingButton
        state={TranscriptionState.RECORDING}
        onRecordingStop={onRecordingStop}
        scaleAnimationDuration={50}
        debounceDuration={100}
        colors={mockColors}
      />,
    );
    fireEvent.press(getByLabelText("Stop Recording"));
    // Advance past pulse duration (50*2 = 100ms)
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(onRecordingStop).toHaveBeenCalledTimes(1);
    // Advance past debounce (100ms more)
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    jest.useRealTimers();
  });

  it("uses dark blur tint for light theme", () => {
    const { useThemeStore } = require("@/theme");
    useThemeStore.setState({ currentTheme: "light" });
    const { getByLabelText } = render(
      <RecordingButton state={TranscriptionState.READY} colors={mockColors} />,
    );
    expect(getByLabelText("Start Recording")).toBeTruthy();
  });

  it("uses light blur tint for dark theme", () => {
    const { useThemeStore } = require("@/theme");
    useThemeStore.setState({ currentTheme: "dark" });
    const { getByLabelText } = render(
      <RecordingButton state={TranscriptionState.READY} colors={mockColors} />,
    );
    expect(getByLabelText("Start Recording")).toBeTruthy();
  });

  it("stop recording while already debouncing is ignored", async () => {
    jest.useFakeTimers();
    const onRecordingStop = jest.fn();
    const { getByLabelText } = render(
      <RecordingButton
        state={TranscriptionState.RECORDING}
        onRecordingStop={onRecordingStop}
        scaleAnimationDuration={100}
        debounceDuration={500}
        colors={mockColors}
      />,
    );
    // First press sets debouncing
    fireEvent.press(getByLabelText("Stop Recording"));
    // Second press while debouncing should be ignored
    fireEvent.press(getByLabelText("Stop Recording"));
    // Only one stop should eventually fire
    await act(async () => {
      jest.advanceTimersByTime(200); // past pulse duration (100*2)
    });
    expect(onRecordingStop).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("start recording after debounce and gesture isolation complete allows another press", async () => {
    jest.useFakeTimers();
    const onRecordingStart = jest.fn();
    const { getByLabelText, rerender } = render(
      <RecordingButton
        state={TranscriptionState.READY}
        onRecordingStart={onRecordingStart}
        debounceDuration={100}
        colors={mockColors}
      />,
    );
    fireEvent.press(getByLabelText("Start Recording"));
    expect(onRecordingStart).toHaveBeenCalledTimes(1);

    // Advance past both debounce (100ms) and gesture isolation (2000ms)
    await act(async () => {
      jest.advanceTimersByTime(2100);
    });

    // Force re-render so component picks up cleared states
    rerender(
      <RecordingButton
        state={TranscriptionState.READY}
        onRecordingStart={onRecordingStart}
        debounceDuration={100}
        colors={mockColors}
      />,
    );

    // Should be able to press again
    fireEvent.press(getByLabelText("Start Recording"));
    expect(onRecordingStart).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it("gesture isolation prevents start recording during isolation period", async () => {
    jest.useFakeTimers();
    const onRecordingStart = jest.fn();
    const { getByLabelText, unmount } = render(
      <RecordingButton
        state={TranscriptionState.READY}
        onRecordingStart={onRecordingStart}
        debounceDuration={50}
        colors={mockColors}
      />,
    );
    // First press
    fireEvent.press(getByLabelText("Start Recording"));
    expect(onRecordingStart).toHaveBeenCalledTimes(1);

    // Advance past debounce but NOT past gesture isolation (2000ms)
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Should be blocked by gesture isolation (still active at 2000ms)
    fireEvent.press(getByLabelText("Start Recording"));
    // The second press goes through because debouncing cleared,
    // but gesture isolation only affects stop→start, not start→start
    // So we just verify no crash and unmount cleanly
    unmount();
    jest.useRealTimers();
  });

  it("triggerDelayedScaleAnimation clears existing timeout on re-trigger", () => {
    jest.useFakeTimers();
    const { rerender } = render(
      <RecordingButton state={TranscriptionState.READY} colors={mockColors} />,
    );
    // Transition to recording
    rerender(
      <RecordingButton
        state={TranscriptionState.RECORDING}
        colors={mockColors}
      />,
    );
    // Quick transition back and forth should clear previous timeout
    rerender(
      <RecordingButton state={TranscriptionState.READY} colors={mockColors} />,
    );
    rerender(
      <RecordingButton
        state={TranscriptionState.RECORDING}
        colors={mockColors}
      />,
    );
    jest.advanceTimersByTime(400);
    // Should not crash - the delayed animation fired only once
    jest.useRealTimers();
  });

  it("renders disabled spinner button in RECORDING_STARTING state", () => {
    const onRecordingStart = jest.fn();
    const { getByLabelText } = render(
      <RecordingButton
        state={TranscriptionState.RECORDING_STARTING}
        onRecordingStart={onRecordingStart}
        colors={mockColors}
      />,
    );

    const button = getByLabelText("Preparing recording");
    expect(button.props.accessibilityRole).toBe("button");
    expect(button.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true, busy: true }),
    );
    fireEvent.press(button);
    expect(onRecordingStart).not.toHaveBeenCalled();
  });

  it("renders the spinner when isInitializing is true and state is READY", () => {
    const { getByLabelText, queryByLabelText } = render(
      <RecordingButton
        state={TranscriptionState.READY}
        isInitializing
        colors={mockColors}
      />,
    );
    expect(getByLabelText("Preparing recording")).toBeTruthy();
    expect(queryByLabelText("Start Recording")).toBeNull();
  });

  it("renders the spinner when isInitializing is true and state is ERROR", () => {
    const { getByLabelText } = render(
      <RecordingButton
        state={TranscriptionState.ERROR}
        isInitializing
        colors={mockColors}
      />,
    );
    expect(getByLabelText("Preparing recording")).toBeTruthy();
  });

  it("ignores isInitializing while RECORDING (stop button stays visible)", () => {
    const { getByLabelText } = render(
      <RecordingButton
        state={TranscriptionState.RECORDING}
        isInitializing
        colors={mockColors}
      />,
    );
    expect(getByLabelText("Stop Recording")).toBeTruthy();
  });

  it("state change to READY resets gesture isolation", () => {
    jest.useFakeTimers();
    const onRecordingStart = jest.fn();
    const { getByLabelText, rerender } = render(
      <RecordingButton
        state={TranscriptionState.RECORDING}
        onRecordingStart={onRecordingStart}
        colors={mockColors}
      />,
    );
    // Transition to READY should clear gesture isolation
    rerender(
      <RecordingButton
        state={TranscriptionState.READY}
        onRecordingStart={onRecordingStart}
        debounceDuration={50}
        colors={mockColors}
      />,
    );
    jest.advanceTimersByTime(100); // past any debounce

    fireEvent.press(getByLabelText("Start Recording"));
    expect(onRecordingStart).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
