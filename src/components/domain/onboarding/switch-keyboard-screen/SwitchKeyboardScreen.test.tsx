import { fireEvent, render } from "@testing-library/react-native";

import { SwitchKeyboardScreen } from "./SwitchKeyboardScreen";

describe("SwitchKeyboardScreen", () => {
  it("renders copy, auto-focuses the input and wires the actions", () => {
    const props = { onBack: jest.fn(), onSkip: jest.fn() };
    const { getByText, getByTestId } = render(
      <SwitchKeyboardScreen {...props} testID="sk" />,
    );
    expect(getByText("onboardingSwitchKeyboardTitle")).toBeTruthy();
    expect(getByText("onboardingSwitchKeyboardSubtitle")).toBeTruthy();
    expect(getByTestId("sk-steps-dot-1")).toHaveStyle({ width: 24 });
    expect(
      getByTestId("sk-input", { includeHiddenElements: true }).props.autoFocus,
    ).toBe(true);
    fireEvent.press(getByTestId("sk-back"));
    fireEvent.press(getByTestId("sk-skip"));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.onSkip).toHaveBeenCalledTimes(1);
  });

  it("renders without a testID", () => {
    const { getByText } = render(
      <SwitchKeyboardScreen onBack={jest.fn()} onSkip={jest.fn()} />,
    );
    expect(getByText("onboardingSwitchKeyboardTitle")).toBeTruthy();
  });
});
