import { act, fireEvent, render } from "@testing-library/react-native";

import { TestID } from "@/constants";

import {
  AllowMicrophoneScreen,
  type AllowMicrophoneScreenProps,
} from "./AllowMicrophoneScreen";

const renderScreen = (overrides: Partial<AllowMicrophoneScreenProps> = {}) => {
  const props = {
    onBack: jest.fn(),
    onSkip: jest.fn(),
    onAllow: jest.fn(),
    testID: "allow-mic",
    ...overrides,
  };
  return { ...render(<AllowMicrophoneScreen {...props} />), props };
};

describe("AllowMicrophoneScreen", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("renders title, step indicator and gradient bars", () => {
    const { getByText, getByTestId } = renderScreen();
    expect(getByText("onboardingAllowMicrophoneTitle")).toBeTruthy();
    expect(getByTestId("allow-mic-steps-dot-2")).toHaveStyle({ width: 24 });
    expect(getByTestId("allow-mic-bars")).toBeTruthy();
  });

  it("wires back and skip", () => {
    const { getByTestId, props } = renderScreen();
    expect(getByTestId("allow-mic-skip").props.accessibilityLabel).toBe(
      "onboardingSkip",
    );
    fireEvent.press(getByTestId("allow-mic-back"));
    fireEvent.press(getByTestId("allow-mic-skip"));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.onSkip).toHaveBeenCalledTimes(1);
  });

  it("calls onAllow from the primary button", () => {
    const { getByTestId, props } = renderScreen();
    fireEvent.press(getByTestId("allow-mic-allow"));
    expect(props.onAllow).toHaveBeenCalledTimes(1);
  });

  it("calls onAllow from the record button instead of recording", () => {
    const { getByTestId, props } = renderScreen();
    fireEvent.press(getByTestId(TestID.RecordingButtonStart));
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(props.onAllow).toHaveBeenCalledTimes(1);
  });

  it("renders without a testID", () => {
    const { getByText } = renderScreen({ testID: undefined });
    expect(getByText("onboardingAllow")).toBeTruthy();
  });
});
