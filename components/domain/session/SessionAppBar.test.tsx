/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { SessionAppBar } from "./SessionAppBar";

jest.mock("@/stores", () => ({
  useSelectedLanguage: jest.fn(() => "en"),
}));

jest.mock("@/models", () => ({
  getCountryCode: jest.fn((lang: string) => lang),
}));

jest.mock("../../ui/icon/FlagIcon", () => ({
  FlagIcon: (props: any) => {
    const { View } = require("react-native");
    return <View testID={`flag-${props.name}`} />;
  },
}));

jest.mock("../../ui/icon/Icon", () => ({
  Icon: (props: any) => {
    const { View } = require("react-native");
    return <View testID={`icon-${props.name}`} />;
  },
}));

jest.mock("../../ui/ripple-pressable/RipplePressable", () => ({
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
jest.mock("../../ui/top-app-bar/TopAppBar", () => ({
  TopAppBar: (props: any) => {
    capturedAppBarProps = props;
    const { View, Text, Pressable } = require("react-native");
    return (
      <View testID="top-app-bar">
        {props.title && (
          <Pressable
            testID="title-pressable"
            onPress={props.onTitlePressed}
            disabled={!props.onTitlePressed}
          >
            <Text testID="title-text">{props.title}</Text>
          </Pressable>
        )}
        {props.leading}
        {props.actions}
      </View>
    );
  },
}));

const defaultProps = {
  sessionName: "My Session",
  selectionMode: false,
  isIncognitoSession: false,
  onBackPressed: jest.fn(),
  onTitlePressed: jest.fn(),
  onCopyAllPressed: jest.fn(),
  onLanguageFlagPressed: jest.fn(),
  onSelectAllPressed: jest.fn(),
  onDeleteSelectedPressed: jest.fn(),
  onCancelEditPressed: jest.fn(),
  onSaveEditPressed: jest.fn(),
};

describe("SessionAppBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedAppBarProps = {};
  });

  it("normal mode: renders session name as title", () => {
    const { getByTestId } = render(<SessionAppBar {...defaultProps} />);
    expect(getByTestId("title-text").props.children).toBe("My Session");
  });

  it("normal mode: renders language flag icon", () => {
    const { getByTestId } = render(<SessionAppBar {...defaultProps} />);
    expect(getByTestId("flag-en")).toBeTruthy();
  });

  it("normal mode: renders copy icon", () => {
    const { getByTestId } = render(<SessionAppBar {...defaultProps} />);
    expect(getByTestId("icon-copy")).toBeTruthy();
  });

  it("normal mode: title press calls onTitlePressed (non-incognito)", () => {
    const { getByTestId } = render(<SessionAppBar {...defaultProps} />);
    fireEvent.press(getByTestId("title-pressable"));
    expect(defaultProps.onTitlePressed).toHaveBeenCalled();
  });

  it("normal mode: title press disabled for incognito session", () => {
    render(<SessionAppBar {...defaultProps} isIncognitoSession={true} />);
    expect(capturedAppBarProps.onTitlePressed).toBeUndefined();
  });

  it('edit mode: renders "Edit" title, close and check icons', () => {
    const { getByTestId } = render(
      <SessionAppBar {...defaultProps} editMode={true} />,
    );
    expect(getByTestId("title-text").props.children).toBe("edit");
    expect(getByTestId("icon-close")).toBeTruthy();
    expect(getByTestId("icon-check")).toBeTruthy();
  });

  it("selection mode: renders select-all and trash icons", () => {
    const { getByTestId } = render(
      <SessionAppBar {...defaultProps} selectionMode={true} />,
    );
    expect(getByTestId("icon-select_all")).toBeTruthy();
    expect(getByTestId("icon-trash")).toBeTruthy();
  });

  it("copy icon opacity = 0.5 when copyAllEnabled=false", () => {
    render(<SessionAppBar {...defaultProps} copyAllEnabled={false} />);
    // The RipplePressable wrapping copy icon receives style={{ opacity: 0.5 }}
    // Verify via captured props — the TopAppBar receives actions array
    const actions = capturedAppBarProps.actions;
    const copyAction = actions?.find((a: any) => a?.key === "copy");
    expect(copyAction?.props?.style).toEqual({ opacity: 0.5 });
  });
});
