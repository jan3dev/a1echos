/* eslint-disable @typescript-eslint/no-require-imports, react/display-name */
import { act, fireEvent, render } from "@testing-library/react-native";
import { useRouter } from "expo-router";
import React from "react";

import { TestID } from "@/constants";
import { useSettingsStore } from "@/stores";

import { HomeAppBar } from "./HomeAppBar";

jest.mock("@/stores", () => ({
  useSettingsStore: jest.fn(),
}));

jest.mock("../../ui/icon/Icon", () => ({
  Icon: (props: any) => {
    const { View } = require("react-native");
    const { dynamicTestID: dTID } = require("@/constants");
    return <View testID={dTID.icon(props.name)} />;
  },
}));

jest.mock("../../ui/ripple-pressable/RipplePressable", () => ({
  RipplePressable: ({ children, onPress, ...props }: any) => {
    const { Pressable } = require("react-native");
    return (
      <Pressable onPress={onPress} {...props}>
        {children}
      </Pressable>
    );
  },
}));

jest.mock("../../ui/top-app-bar/TopAppBar", () => {
  const { TestID: TID } = require("@/constants");
  return {
    TopAppBar: (props: any) => {
      const { View } = require("react-native");
      return (
        <View testID={TID.TopAppBar}>
          {props.leading}
          {props.actions}
        </View>
      );
    },
  };
});

jest.mock("./IncognitoExplainerModal", () => {
  const { TestID: TID } = require("@/constants");
  return {
    IncognitoExplainerModal: () => {
      const { View } = require("react-native");
      return <View testID={TID.IncognitoModal} />;
    },
  };
});

const mockSettingsStore = {
  isIncognitoMode: false,
  hasSeenIncognitoExplainer: true,
  setIncognitoMode: jest.fn(),
  markIncognitoExplainerSeen: jest.fn(),
};

describe("HomeAppBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSettingsStore as unknown as jest.Mock).mockReturnValue(
      mockSettingsStore,
    );
  });

  it("renders echos logo in normal mode", () => {
    const { getByTestId } = render(<HomeAppBar selectionMode={false} />);
    expect(getByTestId("icon-echos_logo")).toBeTruthy();
  });

  it("renders settings icon button in normal mode", () => {
    const { getByTestId } = render(<HomeAppBar selectionMode={false} />);
    expect(getByTestId("icon-hamburger")).toBeTruthy();
  });

  it("settings button navigates to /settings", () => {
    const mockRouter = (useRouter as jest.Mock)();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    const { getByTestId } = render(<HomeAppBar selectionMode={false} />);
    const settingsIcon = getByTestId("icon-hamburger");
    fireEvent.press(settingsIcon.parent!);
    expect(mockRouter.push).toHaveBeenCalledWith("/settings");
  });

  it("renders ghost icon for incognito toggle", () => {
    const { getByTestId } = render(<HomeAppBar selectionMode={false} />);
    expect(getByTestId("icon-ghost")).toBeTruthy();
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

  it("incognito toggle calls setIncognitoMode with toggled value", async () => {
    const { getByTestId } = render(<HomeAppBar selectionMode={false} />);
    await fireEvent.press(getByTestId("icon-ghost").parent!);
    expect(mockSettingsStore.setIncognitoMode).toHaveBeenCalledWith(true);
  });

  it("incognito toggle shows modal when first time enabling", async () => {
    (useSettingsStore as unknown as jest.Mock).mockReturnValue({
      ...mockSettingsStore,
      isIncognitoMode: false,
      hasSeenIncognitoExplainer: false,
    });

    // Override IncognitoExplainerModal to expose visible prop
    jest.requireMock("./IncognitoExplainerModal").IncognitoExplainerModal = (
      props: any,
    ) => {
      const { View } = require("react-native");
      const { TestID: TID } = require("@/constants");
      return props.visible ? <View testID={TID.IncognitoModalVisible} /> : null;
    };

    const { getByTestId } = render(<HomeAppBar selectionMode={false} />);
    await act(async () => {
      fireEvent.press(getByTestId("icon-ghost").parent!);
    });
    expect(getByTestId(TestID.IncognitoModalVisible)).toBeTruthy();
  });

  it("incognito toggle does not show modal when already seen explainer", async () => {
    (useSettingsStore as unknown as jest.Mock).mockReturnValue({
      ...mockSettingsStore,
      isIncognitoMode: false,
      hasSeenIncognitoExplainer: true,
    });

    jest.requireMock("./IncognitoExplainerModal").IncognitoExplainerModal = (
      props: any,
    ) => {
      const { View } = require("react-native");
      const { TestID: TID } = require("@/constants");
      return props.visible ? <View testID={TID.IncognitoModalVisible} /> : null;
    };

    const { queryByTestId, getByTestId } = render(
      <HomeAppBar selectionMode={false} />,
    );
    await fireEvent.press(getByTestId("icon-ghost").parent!);
    expect(queryByTestId(TestID.IncognitoModalVisible)).toBeNull();
  });

  it("incognito toggle does not show modal when disabling incognito", async () => {
    (useSettingsStore as unknown as jest.Mock).mockReturnValue({
      ...mockSettingsStore,
      isIncognitoMode: true,
      hasSeenIncognitoExplainer: false,
    });

    jest.requireMock("./IncognitoExplainerModal").IncognitoExplainerModal = (
      props: any,
    ) => {
      const { View } = require("react-native");
      const { TestID: TID } = require("@/constants");
      return props.visible ? <View testID={TID.IncognitoModalVisible} /> : null;
    };

    const { queryByTestId, getByTestId } = render(
      <HomeAppBar selectionMode={false} />,
    );
    await fireEvent.press(getByTestId("icon-ghost").parent!);
    // Disabling incognito mode (newValue=false), so modal should not show
    expect(mockSettingsStore.setIncognitoMode).toHaveBeenCalledWith(false);
    expect(queryByTestId(TestID.IncognitoModalVisible)).toBeNull();
  });

  it("in selection mode: hides ghost and settings icons", () => {
    const { queryByTestId } = render(<HomeAppBar selectionMode={true} />);
    expect(queryByTestId("icon-ghost")).toBeNull();
    expect(queryByTestId("icon-hamburger")).toBeNull();
  });

  it("in normal mode: hides trash and back icons", () => {
    const { queryByTestId } = render(<HomeAppBar selectionMode={false} />);
    expect(queryByTestId("icon-trash")).toBeNull();
    expect(queryByTestId("icon-chevron_left")).toBeNull();
  });

  it("onDeleteSelected not called when not provided", () => {
    const { getByTestId } = render(<HomeAppBar selectionMode={true} />);
    // Should not throw when pressing trash without handler
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

  it("handleIncognitoDismiss calls markIncognitoExplainerSeen and closes modal", async () => {
    (useSettingsStore as unknown as jest.Mock).mockReturnValue({
      ...mockSettingsStore,
      isIncognitoMode: false,
      hasSeenIncognitoExplainer: false,
      markIncognitoExplainerSeen: jest.fn().mockResolvedValue(undefined),
    });

    // Override IncognitoExplainerModal to expose onConfirm
    jest.requireMock("./IncognitoExplainerModal").IncognitoExplainerModal = (
      props: any,
    ) => {
      const { View, Pressable } = require("react-native");
      const { TestID: TID } = require("@/constants");
      return props.visible ? (
        <View testID={TID.IncognitoModalVisible}>
          <Pressable testID={TID.ConfirmBtn} onPress={props.onConfirm} />
          <Pressable testID={TID.CancelBtn} onPress={props.onCancel} />
        </View>
      ) : null;
    };

    const store = (useSettingsStore as unknown as jest.Mock)();
    const { getByTestId, queryByTestId } = render(
      <HomeAppBar selectionMode={false} />,
    );

    // Enable incognito (first time) to show modal
    await act(async () => {
      fireEvent.press(getByTestId("icon-ghost").parent!);
    });

    expect(getByTestId(TestID.IncognitoModalVisible)).toBeTruthy();

    // Confirm the modal
    await act(async () => {
      fireEvent.press(getByTestId(TestID.ConfirmBtn));
    });

    expect(store.markIncognitoExplainerSeen).toHaveBeenCalled();
    expect(queryByTestId(TestID.IncognitoModalVisible)).toBeNull();
  });

  it("IncognitoExplainerModal onCancel closes modal without marking seen", async () => {
    (useSettingsStore as unknown as jest.Mock).mockReturnValue({
      ...mockSettingsStore,
      isIncognitoMode: false,
      hasSeenIncognitoExplainer: false,
    });

    jest.requireMock("./IncognitoExplainerModal").IncognitoExplainerModal = (
      props: any,
    ) => {
      const { View, Pressable } = require("react-native");
      const { TestID: TID } = require("@/constants");
      return props.visible ? (
        <View testID={TID.IncognitoModalVisible}>
          <Pressable testID={TID.CancelBtn} onPress={props.onCancel} />
        </View>
      ) : null;
    };

    const { getByTestId, queryByTestId } = render(
      <HomeAppBar selectionMode={false} />,
    );

    // Enable incognito (first time) to show modal
    await act(async () => {
      fireEvent.press(getByTestId("icon-ghost").parent!);
    });

    expect(getByTestId(TestID.IncognitoModalVisible)).toBeTruthy();

    // Cancel the modal
    await act(async () => {
      fireEvent.press(getByTestId(TestID.CancelBtn));
    });

    expect(queryByTestId(TestID.IncognitoModalVisible)).toBeNull();
    expect(mockSettingsStore.markIncognitoExplainerSeen).not.toHaveBeenCalled();
  });
});
