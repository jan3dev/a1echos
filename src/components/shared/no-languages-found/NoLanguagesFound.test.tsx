import { render } from "@testing-library/react-native";
import React from "react";
import { AccessibilityInfo } from "react-native";

import { darkColors } from "@/theme";

import { NoLanguagesFound } from "./NoLanguagesFound";

describe("NoLanguagesFound", () => {
  it("renders the title and description in the pinned colors", () => {
    const { getByText } = render(
      <NoLanguagesFound query="Klingon" colors={darkColors} />,
    );
    expect(getByText("noLanguagesFoundTitle")).toHaveStyle({
      color: darkColors.textPrimary,
    });
    expect(getByText("noLanguagesFoundDescription")).toBeTruthy();
  });

  it("announces the empty state to screen readers", () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    render(<NoLanguagesFound query="Klingon" />);
    expect(announce).toHaveBeenCalledWith("noLanguagesFoundTitle");
  });
});
