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

jest.mock("./SessionMoreMenu", () => {
  const { TestID: TID } = require("@/constants");
  return {
    SessionMoreMenu: () => {
      const { View } = require("react-native");
      return <View testID={TID.SessionMoreMenu} />;
    },
  };
});

jest.mock("../../shared/list-item/ListItem", () => ({
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

jest.mock("../../ui/checkbox/Checkbox", () => ({
  Checkbox: (props: any) => {
    const { View } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return <View testID={TID.Checkbox} />;
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
    // useLocalization.loc.transcriptionCount calls t('transcriptionCount', { count: 2 })
    // which returns the key as string
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

  it("selection mode shows checkbox, not SessionMoreMenu", () => {
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
