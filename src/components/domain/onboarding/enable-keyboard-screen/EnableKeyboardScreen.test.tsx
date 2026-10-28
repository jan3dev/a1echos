import { act, fireEvent, render } from "@testing-library/react-native";
import { useRef } from "react";
import { Platform, View } from "react-native";
import * as Reanimated from "react-native-reanimated";
import { useSafeAreaFrame } from "react-native-safe-area-context";

import { ANDROID_DEMO_DONE } from "./AndroidSettingsDemo";
import {
  EnableKeyboardScreen,
  type EnableKeyboardScreenProps,
} from "./EnableKeyboardScreen";
import { IOS_DEMO_DONE } from "./IosSettingsDemo";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: jest.fn(() => ({ x: 0, y: 0, width: 390, height: 844 })),
}));
const mockFrame = jest.mocked(useSafeAreaFrame);
const mockReducedMotion = jest.mocked(Reanimated.useReducedMotion);
const hidden = { includeHiddenElements: true };

// Run the worklets for real so the timeline's styles land on the views.
beforeAll(() => {
  jest.mocked(Reanimated.useAnimatedStyle).mockImplementation(((fn: () => unknown) => fn()) as never);
  jest
    .mocked(Reanimated.useSharedValue)
    .mockImplementation((value) => useRef({ value }).current as never);
  Object.assign(Reanimated, {
    interpolateColor: (p: number, _: number[], colors: string[]) =>
      colors[p < 0.5 ? 0 : 1],
  });
});

const renderScreen = (overrides: Partial<EnableKeyboardScreenProps> = {}) => {
  const props = {
    onBack: jest.fn(),
    onSkip: jest.fn(),
    onGoToSettings: jest.fn(),
    testID: "kb",
    ...overrides,
  };
  return { ...render(<EnableKeyboardScreen {...props} />), props };
};

describe("EnableKeyboardScreen", () => {
  const originalOS = Platform.OS;
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    Platform.OS = originalOS;
    mockReducedMotion.mockReturnValue(false);
  });

  it("renders title, step indicator, tooltip and CTA", () => {
    const { getByText, getByTestId, getByLabelText } = renderScreen();
    expect(getByText("onboardingEnableKeyboardTitle")).toBeTruthy();
    expect(getByLabelText("onboardingEnableKeyboardTooltip")).toBeTruthy();
    expect(getByTestId("kb-steps-dot-2")).toHaveStyle({ width: 24 });
    expect(getByTestId("kb-go-to-settings")).toBeTruthy();
  });

  it("wires back and skip", () => {
    const { getByTestId, props } = renderScreen();
    fireEvent.press(getByTestId("kb-back"));
    fireEvent.press(getByTestId("kb-skip"));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.onSkip).toHaveBeenCalledTimes(1);
  });

  it("on iOS plays the Settings animation once, then unlocks the CTA", () => {
    Platform.OS = "ios";
    const { getByTestId, props, UNSAFE_root } = renderScreen();
    const frame = () =>
      UNSAFE_root.findByType("SkiaSkottie" as never).props.frame.value;
    expect(frame()).toBe(0);

    act(() => jest.advanceTimersByTime(IOS_DEMO_DONE - 1));
    fireEvent.press(getByTestId("kb-go-to-settings"));
    expect(props.onGoToSettings).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(1));
    // Holds the last frame before the design's loop-reset segment.
    expect(frame()).toBe(194);
    fireEvent.press(getByTestId("kb-go-to-settings"));
    expect(props.onGoToSettings).toHaveBeenCalledTimes(1);
  });

  it("on Android toggles Echos through the system dialog, then unlocks the CTA", () => {
    Platform.OS = "android";
    const { getByTestId, getByText, queryByTestId, props } = renderScreen();
    expect(queryByTestId("kb-full-access", hidden)).toBeNull();
    expect(getByTestId("kb-echos", hidden)).toBeTruthy();
    expect(getByText("onboardingEnableKeyboardDialogOk", hidden)).toBeTruthy();

    act(() => jest.advanceTimersByTime(ANDROID_DEMO_DONE - 1));
    fireEvent.press(getByTestId("kb-go-to-settings"));
    expect(props.onGoToSettings).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(1));
    fireEvent.press(getByTestId("kb-go-to-settings"));
    expect(props.onGoToSettings).toHaveBeenCalledTimes(1);
  });

  it("replays the walkthrough on every mount", () => {
    const first = renderScreen();
    act(() => jest.advanceTimersByTime(IOS_DEMO_DONE));
    first.unmount();

    const { getByTestId, props } = renderScreen();
    fireEvent.press(getByTestId("kb-go-to-settings"));
    expect(props.onGoToSettings).not.toHaveBeenCalled();
  });

  it("skips straight to the end with Reduce Motion", () => {
    mockReducedMotion.mockReturnValue(true);
    const { getByTestId, props, UNSAFE_root } = renderScreen();
    expect(
      UNSAFE_root.findByType("SkiaSkottie" as never).props.frame.value,
    ).toBe(194);
    fireEvent.press(getByTestId("kb-go-to-settings"));
    expect(props.onGoToSettings).toHaveBeenCalledTimes(1);
  });

  it("renders without a testID", () => {
    const { getByText } = renderScreen({ testID: undefined });
    expect(getByText("onboardingGoToSettings")).toBeTruthy();
  });

  it("scales the walkthrough down to fit a short landscape window", () => {
    mockFrame.mockReturnValueOnce({ x: 0, y: 0, width: 720, height: 360 });
    const { getByTestId } = render(
      <View style={{ width: 720, height: 360 }}>
        <EnableKeyboardScreen
          onBack={jest.fn()}
          onSkip={jest.fn()}
          onGoToSettings={jest.fn()}
          testID="kb"
        />
      </View>,
    );
    const layout = (height: number) => ({
      nativeEvent: { layout: { x: 0, y: 0, width: 343, height } },
    });
    fireEvent(getByTestId("kb-illustration"), "layout", layout(156));
    fireEvent(getByTestId("kb-illustration-content"), "layout", layout(312));
    expect(getByTestId("kb-illustration-content")).toHaveStyle({
      transform: [{ scale: 0.5 }],
    });
  });
});
