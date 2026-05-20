/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";

import { IncognitoEmptyState } from "./IncognitoEmptyState";

jest.mock("../../../ui/icon/Icon", () => ({
  Icon: (props: any) => {
    const { View } = require("react-native");
    const { dynamicTestID: dTID } = require("@/constants");
    return <View testID={dTID.icon(props.name)} />;
  },
}));

jest.mock("../../../ui/text/Text", () => ({
  Text: (props: any) => {
    const { Text: RNText } = require("react-native");
    return <RNText>{props.children}</RNText>;
  },
}));

describe("IncognitoEmptyState", () => {
  it("renders the ghost icon", () => {
    const { getByTestId } = render(<IncognitoEmptyState />);
    expect(getByTestId("icon-ghost")).toBeTruthy();
  });

  it("renders the title from localization", () => {
    const { getByText } = render(<IncognitoEmptyState />);
    expect(getByText("incognitoEmptyStateTitle")).toBeTruthy();
  });

  it("renders the description from localization", () => {
    const { getByText } = render(<IncognitoEmptyState />);
    expect(getByText("incognitoEmptyStateDescription")).toBeTruthy();
  });

  it("uses the IncognitoEmptyState testID", () => {
    const { getByTestId } = render(<IncognitoEmptyState />);
    expect(getByTestId(TestID.IncognitoEmptyState)).toBeTruthy();
  });
});
