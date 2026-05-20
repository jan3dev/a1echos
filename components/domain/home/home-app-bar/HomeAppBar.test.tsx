/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import { useRouter } from "expo-router";
import React from "react";

import { useIsIncognitoMode, useSetIncognitoMode } from "@/stores";

import { HomeAppBar } from "./HomeAppBar";

jest.mock("@/stores", () => ({
  useIsIncognitoMode: jest.fn(),
  useSetIncognitoMode: jest.fn(),
}));

jest.mock("../../../ui/icon/Icon", () => ({
  Icon: (props: any) => {
    const { View } = require("react-native");
    const { dynamicTestID: dTID } = require("@/constants");
    return <View testID={dTID.icon(props.name)} />;
  },
}));

jest.mock("../../../ui/ripple-pressable/RipplePressable", () => ({
  RipplePressable: ({ children, onPress, ...props }: any) => {
    const { Pressable } = require("react-native");
    return (
      <Pressable onPress={onPress} {...props}>
        {children}
      </Pressable>
    );
  },
}));

jest.mock("../../../ui/top-app-bar/TopAppBar", () => {
  const { TestID: TID } = require("@/constants");
  return {
    TopAppBar: (props: any) => {
      const { View } = require("react-native");
      return (
        <View testID={TID.TopAppBar}>
          {props.leading}
          {props.titleWidget}
          {props.actions}
        </View>
      );
    },
  };
});

const mockSetIncognitoMode = jest.fn();

describe("HomeAppBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useIsIncognitoMode as jest.Mock).mockReturnValue(false);
    (useSetIncognitoMode as jest.Mock).mockReturnValue(mockSetIncognitoMode);
  });

  it("renders echos logo in normal mode", () => {
    const { getByTestId } = render(<HomeAppBar selectionMode={false} />);
    expect(getByTestId("icon-echos_logo")).toBeTruthy();
  });

  it("renders settings icon button in normal mode", () => {
    const { getByTestId } = render(<HomeAppBar selectionMode={false} />);
    expect(getByTestId("icon-menu")).toBeTruthy();
  });

  it("settings button navigates to /settings", () => {
    const mockRouter = (useRouter as jest.Mock)();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    const { getByTestId } = render(<HomeAppBar selectionMode={false} />);
    const settingsIcon = getByTestId("icon-menu");
    fireEvent.press(settingsIcon.parent!);
    expect(mockRouter.push).toHaveBeenCalledWith("/settings");
  });

  it("renders ghost icon when incognito mode is off", () => {
    const { getByTestId } = render(<HomeAppBar selectionMode={false} />);
    expect(getByTestId("icon-ghost")).toBeTruthy();
  });

  it("renders ghost_on icon when incognito mode is on", () => {
    (useIsIncognitoMode as jest.Mock).mockReturnValue(true);
    const { getByTestId } = render(<HomeAppBar selectionMode={false} />);
    expect(getByTestId("icon-ghost_on")).toBeTruthy();
  });

  it("in selection mode: renders back chevron (not logo)", () => {
    const { getByTestId, queryByTestId } = render(
      <HomeAppBar selectionMode={true} />,
    );
    expect(getByTestId("icon-chevron_left")).toBeTruthy();
    expect(queryByTestId("icon-echos_logo")).toBeNull();
  });

  it("in selection mode: renders trash icon", () => {
    const { getByTestId } = render(<HomeAppBar selectionMode={true} />);
    expect(getByTestId("icon-trash")).toBeTruthy();
  });

  it("trash press calls onDeleteSelected", () => {
    const onDeleteSelected = jest.fn();
    const { getByTestId } = render(
      <HomeAppBar selectionMode={true} onDeleteSelected={onDeleteSelected} />,
    );
    fireEvent.press(getByTestId("icon-trash").parent!);
    expect(onDeleteSelected).toHaveBeenCalledTimes(1);
  });

  it("back chevron press calls onExitSelectionMode", () => {
    const onExit = jest.fn();
    const { getByTestId } = render(
      <HomeAppBar selectionMode={true} onExitSelectionMode={onExit} />,
    );
    fireEvent.press(getByTestId("icon-chevron_left").parent!);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("ghost press toggles incognito mode on", async () => {
    const { getByTestId } = render(<HomeAppBar selectionMode={false} />);
    await fireEvent.press(getByTestId("icon-ghost").parent!);
    expect(mockSetIncognitoMode).toHaveBeenCalledWith(true);
  });

  it("ghost_on press toggles incognito mode off", async () => {
    (useIsIncognitoMode as jest.Mock).mockReturnValue(true);
    const { getByTestId } = render(<HomeAppBar selectionMode={false} />);
    await fireEvent.press(getByTestId("icon-ghost_on").parent!);
    expect(mockSetIncognitoMode).toHaveBeenCalledWith(false);
  });

  it("in selection mode: hides ghost and settings icons", () => {
    const { queryByTestId } = render(<HomeAppBar selectionMode={true} />);
    expect(queryByTestId("icon-ghost")).toBeNull();
    expect(queryByTestId("icon-menu")).toBeNull();
  });

  it("in normal mode: hides trash and back icons", () => {
    const { queryByTestId } = render(<HomeAppBar selectionMode={false} />);
    expect(queryByTestId("icon-trash")).toBeNull();
    expect(queryByTestId("icon-chevron_left")).toBeNull();
  });

  it("onDeleteSelected not called when not provided", () => {
    const { getByTestId } = render(<HomeAppBar selectionMode={true} />);
    expect(() =>
      fireEvent.press(getByTestId("icon-trash").parent!),
    ).not.toThrow();
  });

  it("onExitSelectionMode not called when not provided", () => {
    const { getByTestId } = render(<HomeAppBar selectionMode={true} />);
    expect(() =>
      fireEvent.press(getByTestId("icon-chevron_left").parent!),
    ).not.toThrow();
  });
});
