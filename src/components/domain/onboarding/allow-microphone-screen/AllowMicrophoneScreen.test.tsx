import { act, fireEvent, render } from "@testing-library/react-native";
import { View } from "react-native";
import { useSafeAreaFrame } from "react-native-safe-area-context";

import { TestID } from "@/constants";

import {
  AllowMicrophoneScreen,
  type AllowMicrophoneScreenProps,
} from "./AllowMicrophoneScreen";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: jest.fn(() => ({ x: 0, y: 0, width: 390, height: 844 })),
}));
const mockFrame = jest.mocked(useSafeAreaFrame);

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

  it("keeps title, bars and allow visible in a short landscape window", () => {
    mockFrame.mockReturnValueOnce({ x: 0, y: 0, width: 720, height: 360 });
    const { getByText, getByTestId } = render(
      <View style={{ width: 720, height: 360 }}>
        <AllowMicrophoneScreen
          onBack={jest.fn()}
          onSkip={jest.fn()}
          onAllow={jest.fn()}
          testID="allow-mic"
        />
      </View>,
    );
    expect(getByText("onboardingAllowMicrophoneTitle")).toBeTruthy();
    expect(getByTestId("allow-mic-bars")).toBeTruthy();
    expect(getByTestId("allow-mic-allow")).toBeTruthy();
    expect(getByTestId(TestID.RecordingButtonStart)).toBeTruthy();
  });
});
