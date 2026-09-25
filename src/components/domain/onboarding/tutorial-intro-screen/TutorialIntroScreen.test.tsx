import { fireEvent, render } from "@testing-library/react-native";

import { TutorialIntroScreen } from "./TutorialIntroScreen";

describe("TutorialIntroScreen", () => {
  it("renders copy without a step indicator and wires the actions", () => {
    const props = { onBack: jest.fn(), onSkip: jest.fn(), onNext: jest.fn() };
    const { getByText, getByTestId, queryByTestId } = render(
      <TutorialIntroScreen {...props} testID="ti" />,
    );
    expect(getByText("onboardingTutorialIntroTitle")).toBeTruthy();
    expect(getByText("onboardingTutorialIntroSubtitle")).toBeTruthy();
    expect(queryByTestId("ti-steps")).toBeNull();
    fireEvent.press(getByTestId("ti-back"));
    fireEvent.press(getByTestId("ti-skip"));
    fireEvent.press(getByTestId("ti-next"));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.onSkip).toHaveBeenCalledTimes(1);
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  it("renders without a testID", () => {
    const { getByText } = render(
      <TutorialIntroScreen
        onBack={jest.fn()}
        onSkip={jest.fn()}
        onNext={jest.fn()}
      />,
    );
    expect(getByText("onboardingNext")).toBeTruthy();
  });
});
