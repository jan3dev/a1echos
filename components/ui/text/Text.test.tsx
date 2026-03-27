import { render } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";

import { AquaTypography } from "@/theme";

import { Text } from "./Text";

describe("Text", () => {
  it("renders children text content", () => {
    const { getByText } = render(<Text>Hello World</Text>);
    expect(getByText("Hello World")).toBeTruthy();
  });

  it("applies default variant body1", () => {
    const { getByText } = render(<Text>Default</Text>);
    const textElement = getByText("Default");
    const flatStyle = StyleSheet.flatten(textElement.props.style);
    expect(flatStyle.fontFamily).toBe(AquaTypography.body1.fontFamily);
    expect(flatStyle.fontSize).toBe(AquaTypography.body1.fontSize);
  });

  it("applies variant style (e.g., h1)", () => {
    const { getByText } = render(<Text variant="h1">Heading</Text>);
    const textElement = getByText("Heading");
    const flatStyle = StyleSheet.flatten(textElement.props.style);
    expect(flatStyle.fontFamily).toBe(AquaTypography.h1.fontFamily);
    expect(flatStyle.fontSize).toBe(AquaTypography.h1.fontSize);
  });

  it("applies weight suffix (medium, semibold)", () => {
    const { getByText: getByTextMedium } = render(
      <Text variant="body1" weight="medium">
        Medium
      </Text>,
    );
    const mediumElement = getByTextMedium("Medium");
    const mediumStyle = StyleSheet.flatten(mediumElement.props.style);
    expect(mediumStyle.fontFamily).toBe(AquaTypography.body1Medium.fontFamily);

    const { getByText: getByTextSemiBold } = render(
      <Text variant="body1" weight="semibold">
        SemiBold
      </Text>,
    );
    const semiBoldElement = getByTextSemiBold("SemiBold");
    const semiBoldStyle = StyleSheet.flatten(semiBoldElement.props.style);
    expect(semiBoldStyle.fontFamily).toBe(
      AquaTypography.body1SemiBold.fontFamily,
    );
  });

  it("accepts custom color prop", () => {
    const { getByText } = render(<Text color="#FF0000">Colored</Text>);
    const textElement = getByText("Colored");
    const flatStyle = StyleSheet.flatten(textElement.props.style);
    expect(flatStyle.color).toBe("#FF0000");
  });
});
