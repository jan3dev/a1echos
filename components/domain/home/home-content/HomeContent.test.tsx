/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";
import { useSettingsStore } from "@/stores";

import { HomeContent } from "./HomeContent";

jest.mock("../../session/session-list/SessionList", () => ({
  SessionList: (props: any) => {
    const { View } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return <View testID={TID.SessionList} {...props} />;
  },
}));

jest.mock("../incognito-empty-state/IncognitoEmptyState", () => ({
  IncognitoEmptyState: () => {
    const { View } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return <View testID={TID.IncognitoEmptyState} />;
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
    useSettingsStore.setState({ isIncognitoMode: false });
  });

  it("renders SessionList component when incognito mode is off", () => {
    const { getByTestId, queryByTestId } = render(
      <HomeContent {...defaultProps} />,
    );
    expect(getByTestId(TestID.SessionList)).toBeTruthy();
    expect(queryByTestId(TestID.IncognitoEmptyState)).toBeNull();
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

  it("renders IncognitoEmptyState instead of SessionList when incognito mode is on", () => {
    useSettingsStore.setState({ isIncognitoMode: true });
    const { getByTestId, queryByTestId } = render(
      <HomeContent {...defaultProps} />,
    );
    expect(getByTestId(TestID.IncognitoEmptyState)).toBeTruthy();
    expect(queryByTestId(TestID.SessionList)).toBeNull();
  });
});
