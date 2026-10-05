import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { View } from "react-native";

import { PRIMARY_BUTTON_HEIGHT } from "../button/Button";
import { FadingGlassBlur } from "../glass-blur-background/FadingGlassBlur";

import { FloatingCTAModule } from "./FloatingCTAModule";

describe("FloatingCTAModule", () => {
  it("renders the buttons over a blur fading in across the primary button", () => {
    const blurTarget = React.createRef<View>();
    const onPress = jest.fn();
    const { getByText, UNSAFE_getByType } = render(
      <FloatingCTAModule
        blurTarget={blurTarget}
        primary={{ text: "Save", onPress }}
      />,
    );
    fireEvent.press(getByText("Save"));
    expect(onPress).toHaveBeenCalledTimes(1);
    const blur = UNSAFE_getByType(FadingGlassBlur);
    expect(blur.props.blurTarget).toBe(blurTarget);
    expect(blur.props.top).toBeUndefined();
    expect(blur.props.fadeHeight).toBe(PRIMARY_BUTTON_HEIGHT);
  });
});
