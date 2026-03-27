import { renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";

import { audioService } from "@/services";
import { useTranscriptionStore } from "@/stores";

import { useBackgroundRecording } from "./useBackgroundRecording";

jest.mock("@/services", () => ({
  audioService: {
    pauseAmplitudeMonitoring: jest.fn(),
    resumeAmplitudeMonitoring: jest.fn(),
  },
}));

const mockPause = audioService.pauseAmplitudeMonitoring as jest.Mock;
const mockResume = audioService.resumeAmplitudeMonitoring as jest.Mock;

describe("useBackgroundRecording", () => {
  let appStateCallback: ((state: string) => void) | null = null;
  const mockRemove = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    appStateCallback = null;

    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_, handler) => {
        appStateCallback = handler as (state: string) => void;
        return { remove: mockRemove } as any;
      });

    Object.defineProperty(AppState, "currentState", {
      value: "active",
      writable: true,
      configurable: true,
    });

    useTranscriptionStore.setState({
      isRecording: () => true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("pauses amplitude when app goes to background while recording", () => {
    renderHook(() => useBackgroundRecording());

    appStateCallback?.("background");

    expect(mockPause).toHaveBeenCalled();
  });

  it("pauses amplitude when app goes to inactive while recording", () => {
    renderHook(() => useBackgroundRecording());

    appStateCallback?.("inactive");

    expect(mockPause).toHaveBeenCalled();
  });

  it("resumes amplitude after 150ms when app comes to foreground while recording", () => {
    renderHook(() => useBackgroundRecording());

    // First go to background
    appStateCallback?.("background");
    mockPause.mockClear();

    // Then come back to foreground
    appStateCallback?.("active");

    // Not called immediately
    expect(mockResume).not.toHaveBeenCalled();

    // Called after 150ms
    jest.advanceTimersByTime(150);
    expect(mockResume).toHaveBeenCalled();
  });

  it("does NOT pause when going to background while not recording", () => {
    useTranscriptionStore.setState({
      isRecording: () => false,
    });

    renderHook(() => useBackgroundRecording());

    appStateCallback?.("background");

    expect(mockPause).not.toHaveBeenCalled();
  });

  it("does NOT resume when coming to foreground while not recording", () => {
    useTranscriptionStore.setState({
      isRecording: () => false,
    });

    renderHook(() => useBackgroundRecording());

    // Go to background then foreground
    appStateCallback?.("background");
    appStateCallback?.("active");
    jest.advanceTimersByTime(150);

    expect(mockResume).not.toHaveBeenCalled();
  });

  it("150ms delay is respected — resume not called before timer fires", () => {
    renderHook(() => useBackgroundRecording());

    // Go to background then foreground
    appStateCallback?.("background");
    appStateCallback?.("active");

    jest.advanceTimersByTime(100);
    expect(mockResume).not.toHaveBeenCalled();

    jest.advanceTimersByTime(50);
    expect(mockResume).toHaveBeenCalled();
  });

  it("cleans up subscription on unmount", () => {
    const { unmount } = renderHook(() => useBackgroundRecording());

    unmount();

    expect(mockRemove).toHaveBeenCalled();
  });
});
