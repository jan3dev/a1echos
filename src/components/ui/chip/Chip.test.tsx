import { render } from "@testing-library/react-native";
import React from "react";
import { View } from "react-native";

import { TestID } from "@/constants";

import { Chip } from "./Chip";

describe("Chip", () => {
  it("renders label", () => {
    const { getByText } = render(<Chip label="Included" />);
    expect(getByText("Included")).toBeTruthy();
  });

  it("renders with testID", () => {
    const { getByTestId } = render(
      <Chip label="Label" testID={TestID.CustomTestId} />,
    );
    expect(getByTestId(TestID.CustomTestId)).toBeTruthy();
  });

  it("renders leading icon element", () => {
    const { getByTestId } = render(
      <Chip label="Label" iconLeading={<View testID={TestID.LeadingIcon} />} />,
    );
    expect(getByTestId(TestID.LeadingIcon)).toBeTruthy();
  });

  it("renders big size by default", () => {
    const { getByText } = render(<Chip label="Label" />);
    expect(getByText("Label")).toBeTruthy();
  });

  it("renders small size", () => {
    const { getByText } = render(<Chip size="small" label="Included" />);
    expect(getByText("Included")).toBeTruthy();
  });
});
