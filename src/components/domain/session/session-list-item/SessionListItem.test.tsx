/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";
import { Session } from "@/models";
import { useSessionTranscriptions } from "@/stores";

import { SessionListItem } from "./SessionListItem";

jest.mock("@/stores", () => ({
  useSessionTranscriptions: jest.fn(() => []),
}));

jest.mock("../../../shared/list-item/ListItem", () => ({
  ListItem: (props: any) => {
    const { Pressable, Text, View } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return (
      <Pressable
        testID={TID.ListItem}
        onPress={props.onPress}
        onLongPress={props.onLongPress}
        accessibilityLabel={props.title}
      >
        <Text testID={TID.ListItemTitle}>{props.title}</Text>
        <Text testID={TID.ListItemSubtitle}>{props.subtitle}</Text>
        <View testID={TID.ListItemTrailing}>{props.iconTrailing}</View>
      </Pressable>
    );
  },
}));

jest.mock("../../../ui/checkbox/Checkbox", () => ({
  Checkbox: () => {
    const { View } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return <View testID={TID.Checkbox} />;
  },
}));

jest.mock("../../../ui/icon/Icon", () => ({
  Icon: (props: any) => {
    const { View } = require("react-native");
    return <View testID={`icon-${props.name}`} />;
  },
}));

jest.mock("../../../ui/ripple-pressable/RipplePressable", () => ({
  RipplePressable: ({ children, onPress, testID }: any) => {
    const { Pressable } = require("react-native");
    return (
      <Pressable testID={testID} onPress={onPress}>
        {children}
      </Pressable>
    );
  },
}));

const mockSession: Session = {
  id: "s1",
  name: "My Session",
  timestamp: new Date(),
  lastModified: new Date(),
  isIncognito: false,
};

const defaultProps = {
  session: mockSession,
  onTap: jest.fn(),
  onLongPress: jest.fn(),
  onMorePress: jest.fn(),
};

describe("SessionListItem", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSessionTranscriptions as jest.Mock).mockReturnValue([
      { id: "t1" },
      { id: "t2" },
    ]);
  });

  it("renders session name as title", () => {
    const { getByTestId } = render(<SessionListItem {...defaultProps} />);
    expect(getByTestId(TestID.ListItemTitle).props.children).toBe("My Session");
  });

  it("renders transcription count subtitle", () => {
    const { getByTestId } = render(<SessionListItem {...defaultProps} />);
    expect(getByTestId(TestID.ListItemSubtitle).props.children).toBeTruthy();
  });

  it("onTap fires callback", () => {
    const { getByTestId } = render(<SessionListItem {...defaultProps} />);
    fireEvent.press(getByTestId(TestID.ListItem));
    expect(defaultProps.onTap).toHaveBeenCalledTimes(1);
  });

  it("long press fires onLongPress callback", () => {
    const { getByTestId } = render(<SessionListItem {...defaultProps} />);
    fireEvent(getByTestId(TestID.ListItem), "longPress");
    expect(defaultProps.onLongPress).toHaveBeenCalledTimes(1);
  });

  it("renders the more trigger when not in selection mode", () => {
    const { getByTestId } = render(<SessionListItem {...defaultProps} />);
    expect(getByTestId(TestID.SessionMoreMenu)).toBeTruthy();
  });

  it("more trigger calls onMorePress with the session", () => {
    const { getByTestId } = render(<SessionListItem {...defaultProps} />);
    fireEvent.press(getByTestId(TestID.SessionMoreMenu));
    expect(defaultProps.onMorePress).toHaveBeenCalledWith(mockSession);
  });

  it("does not render the more trigger when onMorePress is omitted", () => {
    const { queryByTestId } = render(
      <SessionListItem
        session={mockSession}
        onTap={jest.fn()}
        onLongPress={jest.fn()}
      />,
    );
    expect(queryByTestId(TestID.SessionMoreMenu)).toBeNull();
  });

  it("selection mode shows checkbox, not the more trigger", () => {
    const { getByTestId, queryByTestId } = render(
      <SessionListItem
        {...defaultProps}
        selectionMode={true}
        isSelected={true}
      />,
    );
    expect(getByTestId(TestID.Checkbox)).toBeTruthy();
    expect(queryByTestId(TestID.SessionMoreMenu)).toBeNull();
  });
});
