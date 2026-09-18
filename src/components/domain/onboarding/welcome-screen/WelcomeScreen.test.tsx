import { fireEvent, render } from "@testing-library/react-native";
import { View } from "react-native";
import { useSafeAreaFrame } from "react-native-safe-area-context";

import { WelcomeScreen } from "./WelcomeScreen";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: jest.fn(() => ({ x: 0, y: 0, width: 390, height: 844 })),
}));
const mockFrame = jest.mocked(useSafeAreaFrame);

describe("WelcomeScreen", () => {
  it("renders the localized title and subtitle", () => {
    const { getByText } = render(
      <WelcomeScreen onGetStarted={jest.fn()} testID="welcome" />,
    );
    expect(getByText("welcomeTitle")).toBeTruthy();
    expect(getByText("welcomeSubtitle")).toBeTruthy();
  });

  it("calls onGetStarted when the CTA is pressed", () => {
    const onGetStarted = jest.fn();
    const { getByTestId } = render(
      <WelcomeScreen onGetStarted={onGetStarted} testID="welcome" />,
    );
    fireEvent.press(getByTestId("welcome-cta"));
    expect(onGetStarted).toHaveBeenCalledTimes(1);
  });

  it("renders without a testID", () => {
    const { getByText } = render(<WelcomeScreen onGetStarted={jest.fn()} />);
    expect(getByText("welcomeGetStarted")).toBeTruthy();
  });

  it("renders title and CTA in a short landscape window", () => {
    mockFrame.mockReturnValueOnce({ x: 0, y: 0, width: 720, height: 360 });
    const { getByText, getByTestId } = render(
      <View style={{ width: 720, height: 360 }}>
        <WelcomeScreen onGetStarted={jest.fn()} testID="welcome" />
      </View>,
    );
    expect(getByText("welcomeTitle")).toBeTruthy();
    expect(getByTestId("welcome-cta")).toBeTruthy();
  });
});
