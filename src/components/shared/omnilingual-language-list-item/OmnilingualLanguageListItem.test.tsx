import { fireEvent, render } from "@testing-library/react-native";

import { OmnilingualLanguageListItem } from "./OmnilingualLanguageListItem";

const cantonese = { code: "yue", name: "Cantonese", script: "Han" };

describe("OmnilingualLanguageListItem", () => {
  it("shows the name and script, and taps through", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <OmnilingualLanguageListItem language={cantonese} onPress={onPress} />,
    );
    expect(getByText("Han")).toBeTruthy();
    fireEvent.press(getByText("Cantonese"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("is reference only without onPress", () => {
    const { queryByRole } = render(
      <OmnilingualLanguageListItem language={cantonese} />,
    );
    // Not announced as a button to screen readers.
    expect(queryByRole("button")).toBeNull();
  });
});
