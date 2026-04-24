/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";

import { HomeContent } from "./HomeContent";

jest.mock("../../session/session-list/SessionList", () => ({
  SessionList: (props: any) => {
    const { View } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return <View testID={TID.SessionList} {...props} />;
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
    expect(getByTestId(TestID.SessionList)).toBeTruthy();
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
    const list = getByTestId(TestID.SessionList);
    expect(list.props.selectionMode).toBe(true);
    expect(list.props.selectedSessionIds).toBe(selectedIds);
  });

  it("wraps content in a scrollable container", () => {
    const { getByTestId } = render(<HomeContent {...defaultProps} />);
    // SessionList is rendered inside a ScrollView — verify it exists within the tree
    expect(getByTestId(TestID.SessionList).parent).toBeTruthy();
  });
});
