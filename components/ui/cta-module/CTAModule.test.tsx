import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { CTAModule } from "./CTAModule";

describe("CTAModule", () => {
  it("renders only the primary button", () => {
    const { getByText, queryByText } = render(
      <CTAModule primary={{ text: "Save", onPress: jest.fn() }} />,
    );
    expect(getByText("Save")).toBeTruthy();
    expect(queryByText("Cancel")).toBeNull();
    expect(queryByText("Discard")).toBeNull();
  });

  it("renders primary and secondary buttons", () => {
    const { getByText, queryByText } = render(
      <CTAModule
        primary={{ text: "Save", onPress: jest.fn() }}
        secondary={{ text: "Cancel", onPress: jest.fn() }}
      />,
    );
    expect(getByText("Save")).toBeTruthy();
    expect(getByText("Cancel")).toBeTruthy();
    expect(queryByText("Discard")).toBeNull();
  });

  it("renders all three buttons", () => {
    const { getByText } = render(
      <CTAModule
        primary={{ text: "Save", onPress: jest.fn() }}
        secondary={{ text: "Cancel", onPress: jest.fn() }}
        tertiary={{ text: "Discard", onPress: jest.fn() }}
      />,
    );
    expect(getByText("Save")).toBeTruthy();
    expect(getByText("Cancel")).toBeTruthy();
    expect(getByText("Discard")).toBeTruthy();
  });

  it("renders primary and tertiary without secondary", () => {
    const { getByText, queryByText } = render(
      <CTAModule
        primary={{ text: "Save", onPress: jest.fn() }}
        tertiary={{ text: "Discard", onPress: jest.fn() }}
      />,
    );
    expect(getByText("Save")).toBeTruthy();
    expect(getByText("Discard")).toBeTruthy();
    expect(queryByText("Cancel")).toBeNull();
  });

  it("invokes each onPress handler", () => {
    const primaryOnPress = jest.fn();
    const secondaryOnPress = jest.fn();
    const tertiaryOnPress = jest.fn();
    const { getByText } = render(
      <CTAModule
        primary={{ text: "Save", onPress: primaryOnPress }}
        secondary={{ text: "Cancel", onPress: secondaryOnPress }}
        tertiary={{ text: "Discard", onPress: tertiaryOnPress }}
      />,
    );
    fireEvent.press(getByText("Save"));
    fireEvent.press(getByText("Cancel"));
    fireEvent.press(getByText("Discard"));
    expect(primaryOnPress).toHaveBeenCalledTimes(1);
    expect(secondaryOnPress).toHaveBeenCalledTimes(1);
    expect(tertiaryOnPress).toHaveBeenCalledTimes(1);
  });

  it("does not invoke onPress when primary is disabled", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <CTAModule primary={{ text: "Save", onPress, enabled: false }} />,
    );
    fireEvent.press(getByText("Save"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("forwards testID", () => {
    const { getByTestId } = render(
      <CTAModule
        testID="cta-test"
        primary={{ text: "Save", onPress: jest.fn() }}
      />,
    );
    expect(getByTestId("cta-test")).toBeTruthy();
  });
});
