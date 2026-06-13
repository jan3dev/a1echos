import { render } from "@testing-library/react-native";
import React from "react";
import { Platform, Text, View } from "react-native";

import { AppBarBlurTarget } from "./AppBarBlurTarget";

describe("AppBarBlurTarget", () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it("renders a plain View on iOS", () => {
    Platform.OS = "ios";
    const json = render(
      <AppBarBlurTarget>
        <Text>child</Text>
      </AppBarBlurTarget>,
    ).toJSON() as any;
    expect(json.type).toBe("View");
  });

  it("renders a BlurTargetView on Android", () => {
    Platform.OS = "android";
    const json = render(
      <AppBarBlurTarget>
        <Text>child</Text>
      </AppBarBlurTarget>,
    ).toJSON() as any;
    expect(json.type).toBe("BlurTargetView");
  });

  it("forwards the targetRef and passes children through", () => {
    Platform.OS = "ios";
    const ref = React.createRef<View>();
    const { getByText } = render(
      <AppBarBlurTarget targetRef={ref}>
        <Text>child</Text>
      </AppBarBlurTarget>,
    );
    expect(getByText("child")).toBeTruthy();
  });
});
