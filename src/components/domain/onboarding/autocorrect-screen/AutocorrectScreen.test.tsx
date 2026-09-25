import { fireEvent, render } from "@testing-library/react-native";

import { AutocorrectScreen } from "./AutocorrectScreen";

describe("AutocorrectScreen", () => {
  it("renders the suggestion preview and wires the actions", () => {
    const props = { onBack: jest.fn(), onSkip: jest.fn(), onNext: jest.fn() };
    const { getByText, getByTestId } = render(
      <AutocorrectScreen {...props} testID="a" />,
    );
    expect(getByText("onboardingAutocorrectTitle")).toBeTruthy();
    expect(getByText("Accurate", { includeHiddenElements: true })).toBeTruthy();
    fireEvent.press(getByTestId("a-next"));
    fireEvent.press(getByTestId("a-back"));
    fireEvent.press(getByTestId("a-skip"));
    expect(props.onNext).toHaveBeenCalledTimes(1);
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.onSkip).toHaveBeenCalledTimes(1);
  });
});
