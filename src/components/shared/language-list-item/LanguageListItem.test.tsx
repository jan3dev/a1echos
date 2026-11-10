import { fireEvent, render } from "@testing-library/react-native";

import { LanguageListItem } from "./LanguageListItem";

const spanish = { code: "es", name: "Spanish" };

describe("LanguageListItem", () => {
  it("shows the name and selection, and selects from the row and the radio", () => {
    const onSelect = jest.fn();
    const { getByText, getByRole } = render(
      <LanguageListItem language={spanish} selected onSelect={onSelect} />,
    );
    expect(getByRole("radio").props.accessibilityState.checked).toBe(true);
    fireEvent.press(getByText("Spanish"));
    fireEvent.press(getByRole("radio"));
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenCalledWith(spanish);
  });

  it("ignores taps when disabled", () => {
    const onSelect = jest.fn();
    const { getByText, getByRole } = render(
      <LanguageListItem
        language={spanish}
        selected={false}
        enabled={false}
        onSelect={onSelect}
      />,
    );
    expect(getByRole("radio").props.accessibilityState.checked).toBe(false);
    fireEvent.press(getByText("Spanish"));
    fireEvent.press(getByRole("radio"));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
