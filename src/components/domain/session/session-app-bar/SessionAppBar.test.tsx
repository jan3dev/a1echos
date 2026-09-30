/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { TestID, dynamicTestID } from "@/constants";

import { SessionAppBar } from "./SessionAppBar";

jest.mock("@/hooks", () => ({
  useLocalization: jest.fn(() => ({
    loc: {
      edit: "edit",
      selectedCount: (count: number) =>
        count === 0 ? "Select items" : `${count} selected`,
    },
  })),
}));

jest.mock("../../../ui/icon/Icon", () => ({
  Icon: (props: any) => {
    const { View } = require("react-native");
    const { dynamicTestID: dTID } = require("@/constants");
    return <View testID={dTID.icon(props.name)} />;
  },
}));

jest.mock("../../../ui/ripple-pressable/RipplePressable", () => ({
  RipplePressable: ({ children, onPress, style, ...props }: any) => {
    const { Pressable } = require("react-native");
    const resolvedStyle =
      typeof style === "function" ? style({ pressed: false }) : style;
    return (
      <Pressable
        onPress={onPress}
        style={resolvedStyle}
        testID={props.testID}
        {...props}
      >
        {children}
      </Pressable>
    );
  },
}));

let capturedAppBarProps: any = {};
jest.mock("../../../ui/top-app-bar/TopAppBar", () => {
  const { TestID: TID } = require("@/constants");
  return {
    TopAppBar: (props: any) => {
      capturedAppBarProps = props;
      const { View, Text, Pressable } = require("react-native");
      return (
        <View testID={TID.TopAppBar}>
          {props.title && (
            <Pressable
              testID={TID.TitlePressable}
              onPress={props.onTitlePressed}
              disabled={!props.onTitlePressed}
            >
              <Text testID={TID.TitleText}>{props.title}</Text>
            </Pressable>
          )}
          {props.leading}
          {props.actions}
        </View>
      );
    },
  };
});

const defaultProps = {
  sessionName: "My Session",
  isIncognitoSession: false,
  onBackPressed: jest.fn(),
  onTitlePressed: jest.fn(),
  onMorePressed: jest.fn(),
  onExitSelectionPressed: jest.fn(),
  onSelectAllPressed: jest.fn(),
};

describe("SessionAppBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedAppBarProps = {};
  });

  it("normal mode: renders session name as title", () => {
    const { getByTestId } = render(<SessionAppBar {...defaultProps} />);
    expect(getByTestId(TestID.TitleText).props.children).toBe("My Session");
  });

  it("normal mode: renders more icon (not copy)", () => {
    const { getByTestId, queryByTestId } = render(
      <SessionAppBar {...defaultProps} />,
    );
    expect(getByTestId(dynamicTestID.icon("more"))).toBeTruthy();
    expect(queryByTestId(dynamicTestID.icon("copy"))).toBeNull();
    expect(queryByTestId(dynamicTestID.icon("select_all"))).toBeNull();
  });

  it("normal mode: more icon press calls onMorePressed", () => {
    const { getByTestId } = render(<SessionAppBar {...defaultProps} />);
    fireEvent.press(getByTestId(dynamicTestID.icon("more")).parent!);
    expect(defaultProps.onMorePressed).toHaveBeenCalled();
  });

  it("normal mode: title press calls onTitlePressed (non-incognito)", () => {
    const { getByTestId } = render(<SessionAppBar {...defaultProps} />);
    fireEvent.press(getByTestId(TestID.TitlePressable));
    expect(defaultProps.onTitlePressed).toHaveBeenCalled();
  });

  it("normal mode: title press disabled for incognito session", () => {
    render(<SessionAppBar {...defaultProps} isIncognitoSession={true} />);
    expect(capturedAppBarProps.onTitlePressed).toBeUndefined();
  });

  it("selection mode: shows selectionTitle and close icon (not more)", () => {
    const { getByTestId, queryByTestId } = render(
      <SessionAppBar
        {...defaultProps}
        selectionMode={true}
        selectionTitle="3 selected"
      />,
    );
    expect(getByTestId(TestID.TitleText).props.children).toBe("3 selected");
    expect(getByTestId(dynamicTestID.icon("close"))).toBeTruthy();
    expect(queryByTestId(dynamicTestID.icon("more"))).toBeNull();
  });

  it("selection mode: close icon press calls onExitSelectionPressed", () => {
    const { getByTestId } = render(
      <SessionAppBar
        {...defaultProps}
        selectionMode={true}
        selectionTitle="1 selected"
      />,
    );
    fireEvent.press(getByTestId(dynamicTestID.icon("close")).parent!);
    expect(defaultProps.onExitSelectionPressed).toHaveBeenCalled();
  });

  it("selection mode: select all icon press calls onSelectAllPressed", () => {
    const { getByTestId } = render(
      <SessionAppBar
        {...defaultProps}
        selectionMode={true}
        selectionTitle="1 selected"
      />,
    );
    fireEvent.press(getByTestId(dynamicTestID.icon("select_all")).parent!);
    expect(defaultProps.onSelectAllPressed).toHaveBeenCalled();
  });

  it("selection mode: title press is disabled", () => {
    render(
      <SessionAppBar
        {...defaultProps}
        selectionMode={true}
        selectionTitle="1 selected"
      />,
    );
    expect(capturedAppBarProps.onTitlePressed).toBeUndefined();
  });
});
