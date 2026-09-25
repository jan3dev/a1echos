import { fireEvent, render } from "@testing-library/react-native";
import { useSafeAreaFrame } from "react-native-safe-area-context";

import { darkColors } from "@/theme";

import {
  SpokenLanguageScreen,
  type SpokenLanguageScreenProps,
} from "./SpokenLanguageScreen";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: jest.fn(() => ({ x: 0, y: 0, width: 390, height: 844 })),
}));
const mockFrame = jest.mocked(useSafeAreaFrame);

const languages = [
  { code: "en", name: "English" },
  { code: "pt", name: "Portuguese" },
];

const renderScreen = (overrides: Partial<SpokenLanguageScreenProps> = {}) => {
  const props = {
    languages,
    selectedCode: "en",
    onSelect: jest.fn(),
    onBack: jest.fn(),
    onSkip: jest.fn(),
    onNext: jest.fn(),
    testID: "sl",
    ...overrides,
  };
  return { ...render(<SpokenLanguageScreen {...props} />), props };
};

describe("SpokenLanguageScreen", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("renders title, step 3 and every language with the selection marked", () => {
    const { getByText, getByTestId, getAllByRole } = renderScreen();
    expect(getByText("onboardingSpokenLanguageTitle")).toBeTruthy();
    expect(getByTestId("sl-steps-dot-3")).toHaveStyle({ width: 24 });
    expect(getByText("English")).toBeTruthy();
    expect(getByText("Portuguese")).toBeTruthy();
    const radios = getAllByRole("radio");
    expect(radios[0].props.accessibilityState.checked).toBe(true);
    expect(radios[1].props.accessibilityState.checked).toBe(false);
  });

  it("uses dark colors regardless of the app theme", () => {
    const { getByText } = renderScreen();
    expect(getByText("English")).toHaveStyle({ color: darkColors.textPrimary });
  });

  it("selects a language from the row and the radio", () => {
    const { getByText, getAllByRole, props } = renderScreen();
    fireEvent.press(getByText("Portuguese"));
    fireEvent.press(getAllByRole("radio")[1]);
    expect(props.onSelect).toHaveBeenCalledTimes(2);
    expect(props.onSelect).toHaveBeenCalledWith(languages[1]);
  });

  it("wires back, skip and next", () => {
    const { getByTestId, props } = renderScreen();
    fireEvent.press(getByTestId("sl-back"));
    fireEvent.press(getByTestId("sl-skip"));
    fireEvent.press(getByTestId("sl-next"));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.onSkip).toHaveBeenCalledTimes(1);
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  it("ignores selection while saving", () => {
    const { getAllByRole, props } = renderScreen({ isSaving: true });
    fireEvent.press(getAllByRole("radio")[1]);
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it("renders in landscape", () => {
    mockFrame.mockReturnValueOnce({ x: 0, y: 0, width: 844, height: 390 });
    const { getByText } = renderScreen();
    expect(getByText("onboardingSpokenLanguageTitle")).toBeTruthy();
  });
});
