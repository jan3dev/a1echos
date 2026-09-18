import { fireEvent, render } from "@testing-library/react-native";
import { View } from "react-native";

import { WelcomeScreen } from "./WelcomeScreen";

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
    const { getByText, getByTestId } = render(
      <View style={{ width: 720, height: 360 }}>
        <WelcomeScreen onGetStarted={jest.fn()} testID="welcome" />
      </View>,
    );
    expect(getByText("welcomeTitle")).toBeTruthy();
    expect(getByTestId("welcome-cta")).toBeTruthy();
  });
});
