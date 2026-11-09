import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";

import { InfoSheet } from "./InfoSheet";

const props = {
  visible: true,
  title: "Smart Split",
  message: "Splits long recordings at natural pauses.",
};

describe("InfoSheet", () => {
  it("renders the title, message and Got It button", () => {
    const { getByText } = render(
      <InfoSheet {...props} onDismiss={jest.fn()} />,
    );
    expect(getByText("Smart Split")).toBeTruthy();
    expect(getByText("Splits long recordings at natural pauses.")).toBeTruthy();
    expect(getByText("gotIt")).toBeTruthy();
  });

  it("Got It dismisses", () => {
    const onDismiss = jest.fn();
    const { getByText } = render(
      <InfoSheet {...props} onDismiss={onDismiss} />,
    );
    fireEvent.press(getByText("gotIt"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("the close button dismisses", () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(
      <InfoSheet {...props} onDismiss={onDismiss} />,
    );
    fireEvent.press(getByTestId(TestID.InfoSheetClose));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders nothing while hidden", () => {
    const { queryByText } = render(
      <InfoSheet {...props} visible={false} onDismiss={jest.fn()} />,
    );
    expect(queryByText("Smart Split")).toBeNull();
  });
});
