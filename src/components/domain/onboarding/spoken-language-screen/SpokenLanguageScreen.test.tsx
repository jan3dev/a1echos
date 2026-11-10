import { fireEvent, render } from "@testing-library/react-native";
import { TextInput } from "react-native";
import { useSafeAreaFrame } from "react-native-safe-area-context";

import { SEARCH_MOTION_MS } from "@/hooks/use-language-search/useLanguageSearch";
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

  it("lists the selected language first and keeps it there on a new pick", () => {
    const { getAllByText, rerender, props } = renderScreen({
      selectedCode: "pt",
    });
    const names = () =>
      getAllByText(/English|Portuguese/).map((t) => t.props.children);
    expect(names()).toEqual(["Portuguese", "English"]);
    rerender(<SpokenLanguageScreen {...props} selectedCode="en" />);
    expect(names()).toEqual(["Portuguese", "English"]);
  });

  it("search replaces the title and filters; inner x clears and keeps it open", () => {
    const utils = renderScreen();
    const { getByText, queryByText, getByTestId, getByLabelText } = utils;
    fireEvent.press(getByTestId("sl-search"));
    expect(queryByText("onboardingSpokenLanguageTitle")).toBeNull();
    const field = utils.UNSAFE_getByType(TextInput);

    fireEvent.changeText(field, "port");
    expect(queryByText("English")).toBeNull();
    expect(getByText("Portuguese")).toBeTruthy();

    fireEvent.changeText(field, "Klingon");
    expect(getByTestId("no-languages-found")).toBeTruthy();

    fireEvent.press(getByLabelText("clearText"));
    expect(getByText("English")).toBeTruthy();
    expect(getByText("Portuguese")).toBeTruthy();
    expect(utils.UNSAFE_getByType(TextInput)).toBeTruthy();
  });

  it("skip becomes the close button while searching and comes back after", () => {
    const { getByTestId, queryByTestId, getByText, props } = renderScreen();
    fireEvent.press(getByTestId("sl-search"));
    expect(queryByTestId("sl-skip")).toBeNull();

    // Ignored while the open animation runs.
    fireEvent.press(getByTestId("sl-close-search"));
    expect(queryByTestId("sl-skip")).toBeNull();

    jest.advanceTimersByTime(SEARCH_MOTION_MS);
    fireEvent.press(getByTestId("sl-close-search"));
    expect(getByTestId("sl-skip")).toBeTruthy();
    expect(getByText("onboardingSpokenLanguageTitle")).toBeTruthy();
    expect(props.onSkip).not.toHaveBeenCalled();
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
