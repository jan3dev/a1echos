import { render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";

import { EmptyStateView } from "./EmptyStateView";

describe("EmptyStateView", () => {
  it("renders the message text", () => {
    const { getByText } = render(<EmptyStateView message="Tap to record" />);
    expect(getByText("Tap to record")).toBeTruthy();
  });

  it("renders inside the empty-state container", () => {
    const { getByTestId } = render(<EmptyStateView message="Hello" />);
    expect(getByTestId(TestID.EmptyStateView)).toBeTruthy();
  });

  it("renders different messages correctly", () => {
    const { getByText, rerender } = render(
      <EmptyStateView message="First message" />,
    );
    expect(getByText("First message")).toBeTruthy();

    rerender(<EmptyStateView message="Second message" />);
    expect(getByText("Second message")).toBeTruthy();
  });
});
