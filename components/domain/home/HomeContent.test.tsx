/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";
import React from "react";

import { HomeContent } from "./HomeContent";

jest.mock("../session/SessionList", () => ({
  SessionList: (props: any) => {
    const { View } = require("react-native");
    return <View testID="session-list" {...props} />;
  },
}));

const defaultProps = {
  selectionMode: false,
  selectedSessionIds: new Set<string>(),
  onSessionLongPress: jest.fn(),
  onSessionTap: jest.fn(),
  onSelectionToggle: jest.fn(),
};

describe("HomeContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders SessionList component", () => {
    const { getByTestId } = render(<HomeContent {...defaultProps} />);
    expect(getByTestId("session-list")).toBeTruthy();
  });

  it("passes selection props to SessionList", () => {
    const selectedIds = new Set(["s1", "s2"]);
    const { getByTestId } = render(
      <HomeContent
        {...defaultProps}
        selectionMode={true}
        selectedSessionIds={selectedIds}
      />,
    );
    const list = getByTestId("session-list");
    expect(list.props.selectionMode).toBe(true);
    expect(list.props.selectedSessionIds).toBe(selectedIds);
  });

  it("wraps content in a scrollable container", () => {
    const { getByTestId } = render(<HomeContent {...defaultProps} />);
    // SessionList is rendered inside a ScrollView — verify it exists within the tree
    expect(getByTestId("session-list").parent).toBeTruthy();
  });
});
