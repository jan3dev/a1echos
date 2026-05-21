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

jest.mock("../../../ui/glass-icon-button/GlassIconButton", () => ({
  GlassIconButton: ({ children, onPress, ...props }: any) => {
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

  it("renders echos logo", () => {
    const { getByTestId } = render(<HomeAppBar />);
    expect(getByTestId("icon-echos_logo")).toBeTruthy();
  });

  it("renders settings icon button", () => {
    const { getByTestId } = render(<HomeAppBar />);
    expect(getByTestId("icon-menu")).toBeTruthy();
  });

  it("settings button navigates to /settings", () => {
    const mockRouter = (useRouter as jest.Mock)();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    const { getByTestId } = render(<HomeAppBar />);
    const settingsIcon = getByTestId("icon-menu");
    fireEvent.press(settingsIcon.parent!);
    expect(mockRouter.push).toHaveBeenCalledWith("/settings");
  });

  it("renders ghost icon when incognito mode is off", () => {
    const { getByTestId } = render(<HomeAppBar />);
    expect(getByTestId("icon-ghost")).toBeTruthy();
  });

  it("renders ghost_on icon when incognito mode is on", () => {
    (useIsIncognitoMode as jest.Mock).mockReturnValue(true);
    const { getByTestId } = render(<HomeAppBar />);
    expect(getByTestId("icon-ghost_on")).toBeTruthy();
  });

  it("ghost press toggles incognito mode on", async () => {
    const { getByTestId } = render(<HomeAppBar />);
    await fireEvent.press(getByTestId("icon-ghost").parent!);
    expect(mockSetIncognitoMode).toHaveBeenCalledWith(true);
  });

  it("ghost_on press toggles incognito mode off", async () => {
    (useIsIncognitoMode as jest.Mock).mockReturnValue(true);
    const { getByTestId } = render(<HomeAppBar />);
    await fireEvent.press(getByTestId("icon-ghost_on").parent!);
    expect(mockSetIncognitoMode).toHaveBeenCalledWith(false);
  });

  it("does not render trash or back chevron", () => {
    const { queryByTestId } = render(<HomeAppBar />);
    expect(queryByTestId("icon-trash")).toBeNull();
    expect(queryByTestId("icon-chevron_left")).toBeNull();
  });

  it("long-pressing the echos logo navigates to design-system in __DEV__", () => {
    const mockRouter = (useRouter as jest.Mock)();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    const { getByTestId } = render(<HomeAppBar />);
    const logo = getByTestId("icon-echos_logo");
    fireEvent(logo.parent!, "longPress");
    expect(mockRouter.push).toHaveBeenCalledWith("/(dev)/design-system");
  });

  it("selection mode: renders back chevron and close icon, hides logo/menu/ghost", () => {
    const { getByTestId, queryByTestId } = render(
      <HomeAppBar selectionMode selectionTitle="2 selected" />,
    );
    expect(getByTestId("icon-chevron_left")).toBeTruthy();
    expect(getByTestId("icon-close")).toBeTruthy();
    expect(queryByTestId("icon-echos_logo")).toBeNull();
    expect(queryByTestId("icon-menu")).toBeNull();
    expect(queryByTestId("icon-ghost")).toBeNull();
  });

  it("selection mode: back chevron press calls onExitSelectionPressed", () => {
    const onExit = jest.fn();
    const { getByTestId } = render(
      <HomeAppBar
        selectionMode
        selectionTitle="1 selected"
        onExitSelectionPressed={onExit}
      />,
    );
    fireEvent.press(getByTestId("icon-chevron_left").parent!);
    expect(onExit).toHaveBeenCalled();
  });

  it("selection mode: close icon press calls onExitSelectionPressed", () => {
    const onExit = jest.fn();
    const { getByTestId } = render(
      <HomeAppBar
        selectionMode
        selectionTitle="1 selected"
        onExitSelectionPressed={onExit}
      />,
    );
    fireEvent.press(getByTestId("icon-close").parent!);
    expect(onExit).toHaveBeenCalled();
  });

  it("selection mode: chevron and close press are no-ops without callback", () => {
    const { getByTestId } = render(
      <HomeAppBar selectionMode selectionTitle="1 selected" />,
    );
    expect(() => {
      fireEvent.press(getByTestId("icon-chevron_left").parent!);
      fireEvent.press(getByTestId("icon-close").parent!);
    }).not.toThrow();
  });
});
