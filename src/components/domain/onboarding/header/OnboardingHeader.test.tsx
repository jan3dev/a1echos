import { fireEvent, render } from "@testing-library/react-native";
import { useSafeAreaFrame } from "react-native-safe-area-context";

import { OnboardingHeader } from "./OnboardingHeader";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: jest.fn(() => ({ x: 0, y: 0, width: 390, height: 844 })),
}));
const mockFrame = jest.mocked(useSafeAreaFrame);

describe("OnboardingHeader", () => {
  it("wires back and skip and marks the active step", () => {
    const onBack = jest.fn();
    const onSkip = jest.fn();
    const { getByTestId } = render(
      <OnboardingHeader step={2} onBack={onBack} onSkip={onSkip} testID="h" />,
    );
    fireEvent.press(getByTestId("h-back"));
    fireEvent.press(getByTestId("h-skip"));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(getByTestId("h-steps-dot-2")).toHaveStyle({ width: 24 });
  });

  it("renders in landscape without a testID", () => {
    mockFrame.mockReturnValueOnce({ x: 0, y: 0, width: 720, height: 360 });
    const { getByText } = render(
      <OnboardingHeader step={1} onBack={jest.fn()} onSkip={jest.fn()} />,
    );
    expect(getByText("onboardingSkip")).toBeTruthy();
  });

  it("hides the step indicator and skip when omitted", () => {
    const { queryByTestId } = render(
      <OnboardingHeader onBack={jest.fn()} testID="h" />,
    );
    expect(queryByTestId("h-steps")).toBeNull();
    expect(queryByTestId("h-skip")).toBeNull();
    expect(queryByTestId("h-back")).toBeTruthy();
  });
});
