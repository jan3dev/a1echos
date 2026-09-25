import { fireEvent, render } from "@testing-library/react-native";

import { DictateScreen } from "./DictateScreen";

describe("DictateScreen", () => {
  it("shows Next only once text is entered, and wires the actions", () => {
    const props = { onBack: jest.fn(), onSkip: jest.fn(), onNext: jest.fn() };
    const { getByText, getByTestId, queryByTestId } = render(
      <DictateScreen {...props} testID="d" />,
    );
    expect(getByText("onboardingDictateTitle")).toBeTruthy();
    expect(getByTestId("d-input").props.autoFocus).toBe(true);
    expect(queryByTestId("d-next")).toBeNull();

    fireEvent.changeText(getByTestId("d-input"), "   ");
    expect(queryByTestId("d-next")).toBeNull();
    fireEvent.changeText(getByTestId("d-input"), "Hello, this is Echos.");
    fireEvent.press(getByTestId("d-next"));
    fireEvent.press(getByTestId("d-back"));
    fireEvent.press(getByTestId("d-skip"));
    expect(props.onNext).toHaveBeenCalledTimes(1);
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.onSkip).toHaveBeenCalledTimes(1);
  });

  it("renders without a testID", () => {
    const { getByText } = render(
      <DictateScreen
        onBack={jest.fn()}
        onSkip={jest.fn()}
        onNext={jest.fn()}
      />,
    );
    expect(getByText("onboardingDictateSubtitle")).toBeTruthy();
  });
});
