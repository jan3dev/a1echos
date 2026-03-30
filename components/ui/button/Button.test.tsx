/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";

import { Button } from "./Button";

describe("Button", () => {
  it.each([
    ["primary"],
    ["secondary"],
    ["tertiary"],
    ["utility"],
    ["utilitySecondary"],
  ] as const)("Button.%s renders with text", (variant) => {
    const Component = Button[variant];
    const { getByText } = render(
      <Component text={`${variant} Action`} onPress={jest.fn()} />,
    );
    expect(getByText(`${variant} Action`)).toBeTruthy();
  });

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
    // ProgressIndicator renders with accessibilityLabel="Loading"
    expect(getByLabelText("Loading")).toBeTruthy();
    // Button text should not be rendered when loading
    expect(queryByText("Submit")).toBeNull();
  });

  // --- Branch coverage: all ButtonVariant values for primary ---
  it.each([["normal"], ["error"], ["success"], ["warning"]] as const)(
    "Button.primary renders with variant=%s",
    (variant) => {
      const { getByText } = render(
        <Button.primary
          text={`${variant} btn`}
          onPress={jest.fn()}
          variant={variant}
        />,
      );
      expect(getByText(`${variant} btn`)).toBeTruthy();
    },
  );

  // --- Branch coverage: all ButtonVariant values for secondary ---
  it.each([["normal"], ["error"], ["success"], ["warning"]] as const)(
    "Button.secondary renders with variant=%s",
    (variant) => {
      const { getByText } = render(
        <Button.secondary
          text={`${variant} btn`}
          onPress={jest.fn()}
          variant={variant}
        />,
      );
      expect(getByText(`${variant} btn`)).toBeTruthy();
    },
  );

  // --- Branch coverage: loading state for secondary ---
  it("shows loading indicator for secondary button when isLoading=true", () => {
    const { getByLabelText, queryByText } = render(
      <Button.secondary text="Save" onPress={jest.fn()} isLoading={true} />,
    );
    expect(getByLabelText("Loading")).toBeTruthy();
    expect(queryByText("Save")).toBeNull();
  });

  // --- Branch coverage: loading state for tertiary ---
  it("shows loading indicator for tertiary button when isLoading=true", () => {
    const { getByLabelText, queryByText } = render(
      <Button.tertiary text="More" onPress={jest.fn()} isLoading={true} />,
    );
    expect(getByLabelText("Loading")).toBeTruthy();
    expect(queryByText("More")).toBeNull();
  });

  // --- Branch coverage: loading state for utility ---
  it("shows loading indicator for utility button when isLoading=true", () => {
    const { getByLabelText, queryByText } = render(
      <Button.utility text="Action" onPress={jest.fn()} isLoading={true} />,
    );
    expect(getByLabelText("Loading")).toBeTruthy();
    expect(queryByText("Action")).toBeNull();
  });

  // --- Branch coverage: disabled state prevents press ---
  it("does not call onPress when enabled=false", () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <Button.primary text="Disabled" onPress={onPress} enabled={false} />,
    );
    fireEvent.press(getByRole("button"));
    expect(onPress).not.toHaveBeenCalled();
  });

  // --- Branch coverage: disabled state applies accessibilityState ---
  it("sets accessibilityState disabled when enabled=false", () => {
    const { getByRole } = render(
      <Button.primary text="Disabled" onPress={jest.fn()} enabled={false} />,
    );
    const button = getByRole("button");
    expect(button.props.accessibilityState).toEqual({ disabled: true });
  });

  // --- Branch coverage: disabled state for secondary with all variants ---
  it.each([["normal"], ["error"], ["success"], ["warning"]] as const)(
    "Button.secondary disabled with variant=%s renders",
    (variant) => {
      const { getByText } = render(
        <Button.secondary
          text="Disabled"
          onPress={jest.fn()}
          enabled={false}
          variant={variant}
        />,
      );
      expect(getByText("Disabled")).toBeTruthy();
    },
  );

  // --- Branch coverage: disabled state for primary with all variants ---
  it.each([["normal"], ["error"], ["success"], ["warning"]] as const)(
    "Button.primary disabled with variant=%s renders",
    (variant) => {
      const { getByText } = render(
        <Button.primary
          text="Disabled"
          onPress={jest.fn()}
          enabled={false}
          variant={variant}
        />,
      );
      expect(getByText("Disabled")).toBeTruthy();
    },
  );

  // --- Branch coverage: disabled state for utility ---
  it("Button.utility disabled renders", () => {
    const { getByText } = render(
      <Button.utility
        text="Disabled Util"
        onPress={jest.fn()}
        enabled={false}
      />,
    );
    expect(getByText("Disabled Util")).toBeTruthy();
  });

  // --- Branch coverage: disabled state for utilitySecondary ---
  it("Button.utilitySecondary disabled renders", () => {
    const { getByText } = render(
      <Button.utilitySecondary
        text="Disabled UtilSec"
        onPress={jest.fn()}
        enabled={false}
      />,
    );
    expect(getByText("Disabled UtilSec")).toBeTruthy();
  });

  // --- Branch coverage: disabled state for tertiary ---
  it("Button.tertiary disabled renders", () => {
    const { getByText } = render(
      <Button.tertiary
        text="Disabled Tert"
        onPress={jest.fn()}
        enabled={false}
      />,
    );
    expect(getByText("Disabled Tert")).toBeTruthy();
  });

  // --- Branch coverage: icon prop renders icon alongside text ---
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

  // --- Branch coverage: icon with utility button ---
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

  // --- Branch coverage: small size ---
  it('renders with size="small"', () => {
    const { getByText } = render(
      <Button.primary text="Small" onPress={jest.fn()} size="small" />,
    );
    expect(getByText("Small")).toBeTruthy();
  });

  // --- Branch coverage: secondary with small size ---
  it('renders secondary with size="small"', () => {
    const { getByText } = render(
      <Button.secondary text="Small Sec" onPress={jest.fn()} size="small" />,
    );
    expect(getByText("Small Sec")).toBeTruthy();
  });
});
