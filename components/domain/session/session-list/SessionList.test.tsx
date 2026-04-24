/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { TestID, dynamicTestID } from "@/constants";
import { Session } from "@/models";
import { useSessions } from "@/stores";

import { SessionList } from "./SessionList";

jest.mock("@/stores", () => ({
  useSessions: jest.fn(() => []),
}));

jest.mock("../session-list-item/SessionListItem", () => ({
  SessionListItem: (props: any) => {
    const { Pressable, Text } = require("react-native");
    const { dynamicTestID: dTID } = require("@/constants");
    return (
      <Pressable
        testID={dTID.sessionItem(props.session.id)}
        onPress={props.onTap}
      >
        <Text>{props.session.name}</Text>
      </Pressable>
    );
  },
}));

jest.mock("../../../ui/card/Card", () => ({
  Card: ({ children }: any) => {
    const { View } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return <View testID={TID.Card}>{children}</View>;
  },
}));

jest.mock("../../../ui/divider/Divider", () => ({
  Divider: () => {
    const { View } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return <View testID={TID.Divider} />;
  },
}));

const mockSessions: Session[] = [
  {
    id: "s1",
    name: "Session 1",
    timestamp: new Date(),
    lastModified: new Date(),
    isIncognito: false,
  },
  {
    id: "s2",
    name: "Session 2",
    timestamp: new Date(),
    lastModified: new Date(),
    isIncognito: false,
  },
  {
    id: "s3",
    name: "Session 3",
    timestamp: new Date(),
    lastModified: new Date(),
    isIncognito: false,
  },
];

const defaultProps = {
  selectionMode: false,
  selectedSessionIds: new Set<string>(),
  onSessionLongPress: jest.fn(),
  onSessionTap: jest.fn(),
  onSelectionToggle: jest.fn(),
};

describe("SessionList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders SessionListItem for each session", () => {
    (useSessions as jest.Mock).mockReturnValue(mockSessions);
    const { getByTestId } = render(<SessionList {...defaultProps} />);
    expect(getByTestId(dynamicTestID.sessionItem("s1"))).toBeTruthy();
    expect(getByTestId(dynamicTestID.sessionItem("s2"))).toBeTruthy();
    expect(getByTestId(dynamicTestID.sessionItem("s3"))).toBeTruthy();
  });

  it("renders dividers between items (not after last)", () => {
    (useSessions as jest.Mock).mockReturnValue(mockSessions);
    const { getAllByTestId } = render(<SessionList {...defaultProps} />);
    const dividers = getAllByTestId(TestID.Divider);
    expect(dividers).toHaveLength(2);
  });

  it("empty sessions renders empty Card", () => {
    (useSessions as jest.Mock).mockReturnValue([]);
    const { getByTestId, queryByTestId } = render(
      <SessionList {...defaultProps} />,
    );
    expect(getByTestId(TestID.Card)).toBeTruthy();
    expect(queryByTestId(dynamicTestID.sessionItem("s1"))).toBeNull();
  });

  it("tap in selection mode calls onSelectionToggle, not onSessionTap", () => {
    (useSessions as jest.Mock).mockReturnValue(mockSessions);
    const { getByTestId } = render(
      <SessionList {...defaultProps} selectionMode={true} />,
    );
    fireEvent.press(getByTestId(dynamicTestID.sessionItem("s1")));
    expect(defaultProps.onSelectionToggle).toHaveBeenCalledWith("s1");
    expect(defaultProps.onSessionTap).not.toHaveBeenCalled();
  });
});
