import { fireEvent, render } from "@testing-library/react-native";

import { AllSetScreen } from "./AllSetScreen";

describe("AllSetScreen", () => {
  it("renders the check and wires back and get started", () => {
    const props = { onBack: jest.fn(), onGetStarted: jest.fn() };
    const { getByText, getByTestId, queryByTestId } = render(
      <AllSetScreen {...props} testID="as" />,
    );
    expect(getByText("onboardingAllSetTitle")).toBeTruthy();
    expect(getByText("onboardingAllSetSubtitle")).toBeTruthy();
    expect(
      getByTestId("as-check", { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(queryByTestId("as-steps")).toBeNull();
    fireEvent.press(getByTestId("as-back"));
    fireEvent.press(getByTestId("as-cta"));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.onGetStarted).toHaveBeenCalledTimes(1);
  });

  it("renders without a testID", () => {
    const { getByText } = render(
      <AllSetScreen onBack={jest.fn()} onGetStarted={jest.fn()} />,
    );
    expect(getByText("welcomeGetStarted")).toBeTruthy();
  });
});
