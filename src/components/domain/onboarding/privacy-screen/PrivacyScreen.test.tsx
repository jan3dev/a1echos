import { fireEvent, render } from "@testing-library/react-native";

import { PrivacyScreen } from "./PrivacyScreen";

describe("PrivacyScreen", () => {
  it("renders copy and wires back and next", () => {
    const props = { onBack: jest.fn(), onNext: jest.fn() };
    const { getByText, getByTestId, queryByTestId } = render(
      <PrivacyScreen {...props} testID="p" />,
    );
    expect(getByText("onboardingPrivacyTitle")).toBeTruthy();
    expect(getByText("onboardingPrivacySubtitle")).toBeTruthy();
    expect(queryByTestId("p-skip")).toBeNull();
    fireEvent.press(getByTestId("p-back"));
    fireEvent.press(getByTestId("p-next"));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  it("renders without a testID", () => {
    const { getByText } = render(
      <PrivacyScreen onBack={jest.fn()} onNext={jest.fn()} />,
    );
    expect(getByText("onboardingNext")).toBeTruthy();
  });
});
