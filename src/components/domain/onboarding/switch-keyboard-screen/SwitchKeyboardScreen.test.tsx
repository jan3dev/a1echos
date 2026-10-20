import { fireEvent, render } from "@testing-library/react-native";
import { Platform } from "react-native";

import { SwitchKeyboardScreen } from "./SwitchKeyboardScreen";

const renderScreen = (onChooseKeyboard = jest.fn()) =>
  render(
    <SwitchKeyboardScreen
      onBack={jest.fn()}
      onSkip={jest.fn()}
      onChooseKeyboard={onChooseKeyboard}
      testID="sk"
    />,
  );

describe("SwitchKeyboardScreen", () => {
  it("renders copy, auto-focuses the input and wires the actions", () => {
    const props = {
      onBack: jest.fn(),
      onSkip: jest.fn(),
      onChooseKeyboard: jest.fn(),
    };
    const { getByText, getByTestId, queryByTestId } = render(
      <SwitchKeyboardScreen {...props} testID="sk" />,
    );
    expect(getByText("onboardingSwitchKeyboardTitle")).toBeTruthy();
    expect(getByText("onboardingSwitchKeyboardSubtitle")).toBeTruthy();
    expect(queryByTestId("sk-choose-keyboard")).toBeNull();
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
      <SwitchKeyboardScreen
        onBack={jest.fn()}
        onSkip={jest.fn()}
        onChooseKeyboard={jest.fn()}
      />,
    );
    expect(getByText("onboardingSwitchKeyboardTitle")).toBeTruthy();
  });

  describe("on Android", () => {
    const originalOS = Platform.OS;
    const originalConstants = Platform.constants;
    const setManufacturer = (Manufacturer: string) =>
      Object.defineProperty(Platform, "constants", {
        value: { ...originalConstants, Manufacturer },
        configurable: true,
      });

    beforeEach(() => {
      Platform.OS = "android";
    });
    afterEach(() => {
      Platform.OS = originalOS;
      Object.defineProperty(Platform, "constants", {
        value: originalConstants,
        configurable: true,
      });
    });

    it("offers the system picker instead of the globe", () => {
      setManufacturer("Google");
      const onChooseKeyboard = jest.fn();
      const { getByText, getByTestId, queryByTestId } =
        renderScreen(onChooseKeyboard);
      expect(getByText("onboardingSwitchKeyboardTitleAndroid")).toBeTruthy();
      expect(getByText("onboardingSwitchKeyboardSubtitleAndroid")).toBeTruthy();
      expect(queryByTestId("sk-samsung-tip")).toBeNull();
      expect(
        queryByTestId("sk-input", { includeHiddenElements: true }),
      ).toBeNull();
      fireEvent.press(getByTestId("sk-choose-keyboard"));
      expect(onChooseKeyboard).toHaveBeenCalledTimes(1);
    });

    it("explains the navigation bar button on Samsung", () => {
      setManufacturer("samsung");
      expect(renderScreen().getByTestId("sk-samsung-tip")).toBeTruthy();
    });
  });
});
