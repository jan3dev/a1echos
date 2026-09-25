import { fireEvent, render } from "@testing-library/react-native";
import { Platform, View } from "react-native";
import { useSafeAreaFrame } from "react-native-safe-area-context";

import {
  EnableKeyboardScreen,
  type EnableKeyboardScreenProps,
} from "./EnableKeyboardScreen";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: jest.fn(() => ({ x: 0, y: 0, width: 390, height: 844 })),
}));
const mockFrame = jest.mocked(useSafeAreaFrame);

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
  });

  it("renders title, step indicator, tooltip and CTA", () => {
    const { getByText, getByTestId } = renderScreen();
    expect(getByText("onboardingEnableKeyboardTitle")).toBeTruthy();
    expect(getByText("onboardingEnableKeyboardTooltip")).toBeTruthy();
    expect(getByTestId("kb-steps-dot-2")).toHaveStyle({ width: 24 });
    expect(getByTestId("kb-list")).toBeTruthy();
    expect(getByTestId("kb-echos")).toBeTruthy();
  });

  it("wires back, skip and go-to-settings", () => {
    const { getByTestId, props } = renderScreen();
    fireEvent.press(getByTestId("kb-back"));
    fireEvent.press(getByTestId("kb-skip"));
    fireEvent.press(getByTestId("kb-go-to-settings"));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.onSkip).toHaveBeenCalledTimes(1);
    expect(props.onGoToSettings).toHaveBeenCalledTimes(1);
  });

  it("shows the Full Access row on iOS", () => {
    Platform.OS = "ios";
    const { getByTestId } = renderScreen();
    expect(getByTestId("kb-full-access")).toBeTruthy();
  });

  it("hides the Full Access row on Android", () => {
    Platform.OS = "android";
    const { queryByTestId } = renderScreen();
    expect(queryByTestId("kb-full-access")).toBeNull();
  });

  it("renders without a testID", () => {
    const { getByText } = renderScreen({ testID: undefined });
    expect(getByText("onboardingGoToSettings")).toBeTruthy();
  });

  it("keeps title, list and CTA visible in a short landscape window", () => {
    mockFrame.mockReturnValueOnce({ x: 0, y: 0, width: 720, height: 360 });
    const { getByText, getByTestId } = render(
      <View style={{ width: 720, height: 360 }}>
        <EnableKeyboardScreen
          onBack={jest.fn()}
          onSkip={jest.fn()}
          onGoToSettings={jest.fn()}
          testID="kb"
        />
      </View>,
    );
    expect(getByText("onboardingEnableKeyboardTitle")).toBeTruthy();
    expect(getByTestId("kb-list")).toBeTruthy();
    expect(getByTestId("kb-go-to-settings")).toBeTruthy();
  });
});
