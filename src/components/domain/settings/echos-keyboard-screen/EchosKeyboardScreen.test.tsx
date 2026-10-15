import { act, fireEvent, render } from "@testing-library/react-native";
import { Platform } from "react-native";

import { TestID } from "@/constants";
import { useThemeStore } from "@/theme";

import { EchosKeyboardScreen } from "./EchosKeyboardScreen";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

const renderScreen = (testID?: string) => {
  const props = { onClose: jest.fn(), onAddKeyboard: jest.fn(), testID };
  return { ...render(<EchosKeyboardScreen {...props} />), props };
};

describe("EchosKeyboardScreen", () => {
  const originalOS = Platform.OS;
  beforeEach(() => {
    Platform.OS = "ios";
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    Platform.OS = originalOS;
  });

  it("renders the title, walkthrough and both CTAs", () => {
    const { getByText, getByTestId } = renderScreen("ek");
    expect(getByText("advancedSettingsKeyboardTitle")).toBeTruthy();
    expect(getByTestId("ek-illustration")).toBeTruthy();
    expect(getByText("keyboardPromptCta")).toBeTruthy();
    expect(getByText("keyboardPromptDismiss")).toBeTruthy();
  });

  it("back, close and Maybe Later all close the screen", () => {
    const { getByTestId, props } = renderScreen("ek");
    fireEvent.press(getByTestId(TestID.TopAppBarBack));
    fireEvent.press(getByTestId("ek-close"));
    fireEvent.press(getByTestId("ek-maybe-later"));
    expect(props.onClose).toHaveBeenCalledTimes(3);
  });

  it("Add Keyboard works without waiting for the walkthrough", () => {
    const { getByTestId, props } = renderScreen("ek");
    fireEvent.press(getByTestId("ek-add-keyboard"));
    expect(props.onAddKeyboard).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["ios", "light"],
    ["ios", "dark"],
    ["android", "light"],
    ["android", "dark"],
  ] as const)("renders the %s walkthrough in %s mode", (os, mode) => {
    Platform.OS = os;
    useThemeStore.setState({ currentTheme: mode });
    const { getByTestId } = renderScreen("ek");
    expect(getByTestId("ek-illustration")).toBeTruthy();
    act(() => useThemeStore.setState({ currentTheme: "light" }));
  });

  it("renders without a testID", () => {
    const { getByText } = renderScreen();
    expect(getByText("keyboardPromptCta")).toBeTruthy();
  });
});
