/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";

import { Button } from "./Button";

describe("Button", () => {
  it.each([["primary"], ["secondary"], ["tertiary"], ["utility"]] as const)(
    "Button.%s renders with text",
    (variant) => {
      const Component = Button[variant];
      const { getByText } = render(
        <Component text={`${variant} Action`} onPress={jest.fn()} />,
      );
      expect(getByText(`${variant} Action`)).toBeTruthy();
    },
  );

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <Button.primary text="Press Me" onPress={onPress} />,
    );
    fireEvent.press(getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("shows loading indicator when isLoading=true", () => {
    const { getByLabelText, queryByText } = render(
      <Button.primary text="Submit" onPress={jest.fn()} isLoading={true} />,
    );
    expect(getByLabelText("Loading")).toBeTruthy();
    expect(queryByText("Submit")).toBeNull();
  });

  it("shows loading indicator for secondary button when isLoading=true", () => {
    const { getByLabelText, queryByText } = render(
      <Button.secondary text="Save" onPress={jest.fn()} isLoading={true} />,
    );
    expect(getByLabelText("Loading")).toBeTruthy();
    expect(queryByText("Save")).toBeNull();
  });

  it("shows loading indicator for tertiary button when isLoading=true", () => {
    const { getByLabelText, queryByText } = render(
      <Button.tertiary text="More" onPress={jest.fn()} isLoading={true} />,
    );
    expect(getByLabelText("Loading")).toBeTruthy();
    expect(queryByText("More")).toBeNull();
  });

  it("shows loading indicator for utility button when isLoading=true", () => {
    const { getByLabelText, queryByText } = render(
      <Button.utility text="Action" onPress={jest.fn()} isLoading={true} />,
    );
    expect(getByLabelText("Loading")).toBeTruthy();
    expect(queryByText("Action")).toBeNull();
  });

  it("does not call onPress when enabled=false", () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <Button.primary text="Disabled" onPress={onPress} enabled={false} />,
    );
    fireEvent.press(getByRole("button"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("sets accessibilityState disabled when enabled=false", () => {
    const { getByRole } = render(
      <Button.primary text="Disabled" onPress={jest.fn()} enabled={false} />,
    );
    const button = getByRole("button");
    expect(button.props.accessibilityState).toEqual({ disabled: true });
  });

  it.each([["primary"], ["secondary"], ["tertiary"], ["utility"]] as const)(
    "Button.%s renders disabled state",
    (variant) => {
      const Component = Button[variant];
      const { getByText } = render(
        <Component
          text={`Disabled ${variant}`}
          onPress={jest.fn()}
          enabled={false}
        />,
      );
      expect(getByText(`Disabled ${variant}`)).toBeTruthy();
    },
  );

  it("renders icon when icon prop is provided", () => {
    const { View } = require("react-native");
    const { getByText, getByTestId } = render(
      <Button.primary
        text="With Icon"
        onPress={jest.fn()}
        icon={<View testID={TestID.TestIcon} />}
      />,
    );
    expect(getByText("With Icon")).toBeTruthy();
    expect(getByTestId(TestID.TestIcon)).toBeTruthy();
  });

  it("renders icon with utility button (includes utilityIconSpacing)", () => {
    const { View } = require("react-native");
    const { getByText, getByTestId } = render(
      <Button.utility
        text="Util Icon"
        onPress={jest.fn()}
        icon={<View testID={TestID.UtilIcon} />}
      />,
    );
    expect(getByText("Util Icon")).toBeTruthy();
    expect(getByTestId(TestID.UtilIcon)).toBeTruthy();
  });

  it.each([["large"], ["small"]] as const)(
    "Button.utility renders with size=%s",
    (size) => {
      const { getByText } = render(
        <Button.utility
          text={`Util ${size}`}
          onPress={jest.fn()}
          size={size}
        />,
      );
      expect(getByText(`Util ${size}`)).toBeTruthy();
    },
  );

  it("does not call onPress while isLoading", () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <Button.primary text="Submitting" onPress={onPress} isLoading={true} />,
    );
    fireEvent.press(getByRole("button"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("sets accessibilityState busy when isLoading", () => {
    const { getByRole } = render(
      <Button.primary text="Submitting" onPress={jest.fn()} isLoading={true} />,
    );
    expect(getByRole("button").props.accessibilityState).toMatchObject({
      busy: true,
    });
  });

  it("renders focus ring overlay only when focused", () => {
    const { getByRole, queryByTestId } = render(
      <Button.tertiary
        text="Focusable"
        onPress={jest.fn()}
        testID="focus-btn"
      />,
    );
    const button = getByRole("button");
    expect(queryByTestId("focus-btn-focus-ring")).toBeNull();
    fireEvent(button, "focus");
    expect(queryByTestId("focus-btn-focus-ring")).not.toBeNull();
    fireEvent(button, "blur");
    expect(queryByTestId("focus-btn-focus-ring")).toBeNull();
  });
});
