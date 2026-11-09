import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { StyleSheet, View } from "react-native";
import type { ReactTestInstance } from "react-test-renderer";

import { dynamicTestID, TestID } from "@/constants";

import { ListItem, ListItemGroup } from "./ListItem";

const defaultProps = {
  title: "Session Title",
};

describe("ListItem", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title text", () => {
    const { getByText } = render(<ListItem {...defaultProps} />);
    expect(getByText("Session Title")).toBeTruthy();
  });

  it("renders subtitle text", () => {
    const { getByText } = render(
      <ListItem {...defaultProps} subtitle="Session subtitle" />,
    );
    expect(getByText("Session subtitle")).toBeTruthy();
  });

  it("onPress fires callback", () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <ListItem {...defaultProps} onPress={onPress} />,
    );
    fireEvent.press(getByLabelText("Session Title"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("onLongPress fires callback", () => {
    const onLongPress = jest.fn();
    const { getByLabelText } = render(
      <ListItem {...defaultProps} onLongPress={onLongPress} />,
    );
    fireEvent(getByLabelText("Session Title"), "longPress");
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("renders leading icon element", () => {
    const { getByTestId } = render(
      <ListItem
        {...defaultProps}
        iconLeading={<View testID={TestID.LeadingIcon} />}
      />,
    );
    expect(getByTestId(TestID.LeadingIcon)).toBeTruthy();
  });

  it("renders trailing icon element", () => {
    const { getByTestId } = render(
      <ListItem
        {...defaultProps}
        iconTrailing={<View testID={TestID.TrailingIcon} />}
      />,
    );
    expect(getByTestId(TestID.TrailingIcon)).toBeTruthy();
  });

  it("selection state applies selected accessibility state", () => {
    const { getByLabelText } = render(
      <ListItem {...defaultProps} selected={true} onPress={jest.fn()} />,
    );
    const button = getByLabelText("Session Title");
    expect(button.props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
  });

  it("renders titleTrailing text", () => {
    const { getByText } = render(
      <ListItem {...defaultProps} titleTrailing="trailing text" />,
    );
    expect(getByText("trailing text")).toBeTruthy();
  });

  it("renders subtitleTrailing text", () => {
    const { getByText } = render(
      <ListItem {...defaultProps} subtitleTrailing="subtitle trailing" />,
    );
    expect(getByText("subtitle trailing")).toBeTruthy();
  });

  it("renders contentWidget instead of subtitle", () => {
    const { getByTestId, queryByText } = render(
      <ListItem
        {...defaultProps}
        subtitle="Should not appear"
        contentWidget={<View testID={TestID.CustomWidget} />}
      />,
    );
    expect(getByTestId(TestID.CustomWidget)).toBeTruthy();
    expect(queryByText("Should not appear")).toBeNull();
  });

  it("unselected state applies selected=false accessibility state", () => {
    const { getByLabelText } = render(
      <ListItem {...defaultProps} selected={false} onPress={jest.fn()} />,
    );
    const button = getByLabelText("Session Title");
    expect(button.props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  it("disabled state when no onPress and no onLongPress", () => {
    const { getByLabelText } = render(<ListItem {...defaultProps} />);
    const button = getByLabelText("Session Title");
    expect(button.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });

  it("renders with testID", () => {
    const { getByTestId } = render(
      <ListItem {...defaultProps} testID={TestID.CustomTestId} />,
    );
    expect(getByTestId(TestID.CustomTestId)).toBeTruthy();
  });

  it("info icon fires its own callback, not the row's", () => {
    const onPress = jest.fn();
    const onInfoPress = jest.fn();
    const { getByLabelText } = render(
      <ListItem
        {...defaultProps}
        onPress={onPress}
        info={{ onPress: onInfoPress, accessibilityLabel: "More Info" }}
      />,
    );
    fireEvent.press(getByLabelText("More Info"));
    expect(onInfoPress).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("info icon gets a testID derived from the row's", () => {
    const { getByTestId } = render(
      <ListItem
        {...defaultProps}
        testID={TestID.CustomTestId}
        info={{ onPress: jest.fn(), accessibilityLabel: "More Info" }}
      />,
    );
    expect(
      getByTestId(dynamicTestID.listItemInfo(TestID.CustomTestId)),
    ).toBeTruthy();
  });

  it("titles with an info icon still wrap; trailing values stay on one line", () => {
    const { getByText } = render(
      <ListItem
        {...defaultProps}
        titleTrailing="5 min"
        info={{ onPress: jest.fn(), accessibilityLabel: "More Info" }}
      />,
    );
    expect(getByText("Session Title").props.numberOfLines).toBe(2);
    expect(getByText("5 min").props.numberOfLines).toBe(1);
  });

  it("grouped rows drop the stroke and corners", () => {
    const { getByLabelText } = render(<ListItem {...defaultProps} grouped />);
    const row = getByLabelText("Session Title");
    expect(row).toHaveStyle({ borderRadius: 0 });
    const inner = row.children[0] as ReactTestInstance;
    expect(StyleSheet.flatten(inner.props.style)).toMatchObject({
      borderWidth: 0,
      borderRadius: 0,
    });
  });

  it("exposes the info icon as an accessibility action on the row", () => {
    const onInfoPress = jest.fn();
    const { getByLabelText } = render(
      <ListItem
        {...defaultProps}
        onPress={jest.fn()}
        info={{ onPress: onInfoPress, accessibilityLabel: "More Info" }}
      />,
    );
    const row = getByLabelText("Session Title");
    expect(row.props.accessibilityActions).toEqual([
      { name: "info", label: "More Info" },
    ]);
    fireEvent(row, "accessibilityAction", {
      nativeEvent: { actionName: "info" },
    });
    expect(onInfoPress).toHaveBeenCalledTimes(1);
  });
});

describe("ListItemGroup", () => {
  it("renders its rows", () => {
    const { getByText } = render(
      <ListItemGroup>
        <ListItem title="One" grouped />
        <ListItem title="Two" grouped />
      </ListItemGroup>,
    );
    expect(getByText("One")).toBeTruthy();
    expect(getByText("Two")).toBeTruthy();
  });
});
