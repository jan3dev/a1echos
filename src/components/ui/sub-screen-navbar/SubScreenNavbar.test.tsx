import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { AquaPrimitiveColors } from "@/theme";

import { SubScreenNavbar, type SubScreenNavbarAction } from "./SubScreenNavbar";

const makeAction = (
  overrides: Partial<SubScreenNavbarAction> = {},
): SubScreenNavbarAction => ({
  key: overrides.key ?? "noop",
  icon: overrides.icon ?? "edit",
  label: overrides.label ?? "Action",
  onPress: overrides.onPress ?? jest.fn(),
  ...overrides,
});

describe("SubScreenNavbar", () => {
  it("renders every action label when visible", () => {
    const { getByText } = render(
      <SubScreenNavbar
        visible
        actions={[
          makeAction({ key: "rename", label: "Rename" }),
          makeAction({ key: "delete", icon: "trash", label: "Delete" }),
        ]}
      />,
    );
    expect(getByText("Rename")).toBeTruthy();
    expect(getByText("Delete")).toBeTruthy();
  });

  it("unmounts after the hide animation completes", () => {
    jest.useFakeTimers();
    const { rerender, queryByText } = render(
      <SubScreenNavbar
        visible
        actions={[makeAction({ key: "rename", label: "Rename" })]}
      />,
    );
    expect(queryByText("Rename")).toBeTruthy();

    rerender(
      <SubScreenNavbar
        visible={false}
        actions={[makeAction({ key: "rename", label: "Rename" })]}
      />,
    );
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(queryByText("Rename")).toBeNull();
    jest.useRealTimers();
  });

  it("fires onPress for enabled actions and ignores disabled ones", () => {
    const onRename = jest.fn();
    const onDelete = jest.fn();
    const { getByTestId } = render(
      <SubScreenNavbar
        visible
        actions={[
          makeAction({
            key: "rename",
            label: "Rename",
            disabled: true,
            onPress: onRename,
            testID: "rename-action",
          }),
          makeAction({
            key: "delete",
            icon: "trash",
            label: "Delete",
            onPress: onDelete,
            testID: "delete-action",
          }),
        ]}
      />,
    );

    fireEvent.press(getByTestId("rename-action"));
    fireEvent.press(getByTestId("delete-action"));

    expect(onRename).not.toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("applies the action color to its label", () => {
    const { getByText } = render(
      <SubScreenNavbar
        visible
        actions={[
          makeAction({
            key: "delete",
            icon: "trash",
            label: "Delete",
            color: AquaPrimitiveColors.scarlet500,
          }),
        ]}
      />,
    );
    const label = getByText("Delete");
    const labelStyles = Array.isArray(label.props.style)
      ? Object.assign({}, ...label.props.style.filter(Boolean))
      : label.props.style;
    expect(labelStyles.color).toBe(AquaPrimitiveColors.scarlet500);
  });
});
