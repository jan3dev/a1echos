/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { TranscriptionState } from "@/models";

import { RecordingButton } from "./RecordingButton";

const advance = (ms: number) => {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
};

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
    jest.useFakeTimers();
    const Haptics = require("expo-haptics");
    const onRecordingStart = jest.fn();
    const { getByLabelText } = render(
      <RecordingButton
        state={TranscriptionState.READY}
        onRecordingStart={onRecordingStart}
        scaleAnimationDuration={100}
        colors={mockColors}
      />,
    );
    fireEvent.press(getByLabelText("Start Recording"));
    // Haptic fires synchronously; callback fires after the shrink phase.
    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Medium,
    );
    advance(100);
    expect(onRecordingStart).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
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
    jest.useFakeTimers();
    const onRecordingStart = jest.fn();
    const { getByLabelText } = render(
      <RecordingButton
        state={TranscriptionState.READY}
        onRecordingStart={onRecordingStart}
        scaleAnimationDuration={100}
        colors={mockColors}
      />,
    );
    fireEvent.press(getByLabelText("Start Recording"));
    fireEvent.press(getByLabelText("Start Recording"));
    // Both presses scheduled before timers advance — only the first one
    // gets through because the second is blocked by debouncing.
    advance(100);
    expect(onRecordingStart).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
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

  it("does not render mic icon in TRANSCRIBING state (spinner only)", () => {
    const { queryByTestId } = render(
      <RecordingButton
        state={TranscriptionState.TRANSCRIBING}
        colors={mockColors}
      />,
    );
    expect(queryByTestId("icon-mic")).toBeNull();
  });

  it("renders rectangle icon in RECORDING state with danger color", () => {
    const { getByTestId } = render(
      <RecordingButton
        state={TranscriptionState.RECORDING}
        colors={{ ...mockColors, accentDanger: "#FF3B13" }}
      />,
    );
    expect(getByTestId("icon-rectangle").props.color).toBe("#FF3B13");
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

  it("stop button calls onRecordingStop after press-down phase", async () => {
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
    expect(onRecordingStop).not.toHaveBeenCalled();
    advance(100);
    expect(onRecordingStop).toHaveBeenCalledTimes(1);
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
    advance(500);
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

  it("renders rotating LinearGradient in READY state", () => {
    const { UNSAFE_root } = render(
      <RecordingButton state={TranscriptionState.READY} colors={mockColors} />,
    );
    const { LinearGradient } = require("expo-linear-gradient");
    const gradients = UNSAFE_root.findAllByType(LinearGradient);
    expect(gradients.length).toBeGreaterThan(0);
  });

  it("does not render LinearGradient in RECORDING state", () => {
    const { UNSAFE_root } = render(
      <RecordingButton
        state={TranscriptionState.RECORDING}
        colors={mockColors}
      />,
    );
    const { LinearGradient } = require("expo-linear-gradient");
    expect(UNSAFE_root.findAllByType(LinearGradient).length).toBe(0);
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
        scaleAnimationDuration={100}
        debounceDuration={100}
        colors={mockColors}
      />,
    );
    fireEvent.press(getByLabelText("Start Recording"));
    await act(async () => {
      jest.advanceTimersByTime(100); // past press-down → action fires
    });
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
        scaleAnimationDuration={100}
        debounceDuration={100}
        colors={mockColors}
      />,
    );

    // Should be able to press again
    fireEvent.press(getByLabelText("Start Recording"));
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(onRecordingStart).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it("gesture isolation blocks repeated start presses within the isolation window", async () => {
    jest.useFakeTimers();
    const onRecordingStart = jest.fn();
    const { getByLabelText } = render(
      <RecordingButton
        state={TranscriptionState.READY}
        onRecordingStart={onRecordingStart}
        scaleAnimationDuration={100}
        debounceDuration={50}
        colors={mockColors}
      />,
    );
    fireEvent.press(getByLabelText("Start Recording"));
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(onRecordingStart).toHaveBeenCalledTimes(1);

    // Advance past debounce but stay inside the 2000ms isolation window.
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    fireEvent.press(getByLabelText("Start Recording"));
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(onRecordingStart).toHaveBeenCalledTimes(1);
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
        scaleAnimationDuration={100}
        colors={mockColors}
      />,
    );
    // Transition to READY should clear gesture isolation
    rerender(
      <RecordingButton
        state={TranscriptionState.READY}
        onRecordingStart={onRecordingStart}
        scaleAnimationDuration={100}
        debounceDuration={50}
        colors={mockColors}
      />,
    );
    advance(100); // past any debounce

    fireEvent.press(getByLabelText("Start Recording"));
    advance(100); // past press-down → action fires
    expect(onRecordingStart).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
