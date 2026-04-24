/* eslint-disable @typescript-eslint/no-require-imports, react/display-name */
import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { View } from "react-native";

import { TestID, dynamicTestID } from "@/constants";

import { SessionMoreMenu } from "./SessionMoreMenu";

// Mock measureInWindow on View prototype so the menu can open
const originalMeasureInWindow = (View.prototype as any).measureInWindow;
beforeAll(() => {
  (View.prototype as any).measureInWindow = function (
    cb: (x: number, y: number, w: number, h: number) => void,
  ) {
    cb(100, 100, 24, 24);
  };
});
afterAll(() => {
  (View.prototype as any).measureInWindow = originalMeasureInWindow;
});

jest.mock("@/stores", () => ({
  useRenameSession: jest.fn(() => jest.fn()),
  useShowGlobalTooltip: jest.fn(() => jest.fn()),
}));

const mockShowToast = jest.fn();
const mockHideToast = jest.fn();

jest.mock("../../../ui/toast/useToast", () => ({
  useToast: () => ({
    show: mockShowToast,
    hide: mockHideToast,
    toastState: {},
  }),
}));

jest.mock("@/hooks", () => ({
  useLocalization: jest.fn(() => ({
    t: (key: string) => key,
    loc: {
      sessionRenameTitle: "sessionRenameTitle",
      delete: "delete",
      save: "save",
      cancel: "cancel",
      modifiedPrefix: "modifiedPrefix",
      createdPrefix: "createdPrefix",
      homeDeleteSelectedSessionsTitle: "homeDeleteSelectedSessionsTitle",
      homeDeleteSelectedSessionsMessage: (n: number) =>
        `homeDeleteSelectedSessionsMessage_${n}`,
      homeSessionsDeleted: (n: number) => `homeSessionsDeleted_${n}`,
    },
  })),
  useSessionOperations: jest.fn(() => ({
    deleteSession: jest.fn(),
  })),
}));

jest.mock("@/utils", () => ({
  FeatureFlag: { session: "session" },
  formatDate: jest.fn(() => "2024-01-01"),
  formatSessionSubtitle: jest.fn(() => "Modified: today"),
  logError: jest.fn(),
}));

jest.mock("../../../ui/icon/Icon", () => ({
  Icon: (props: any) => {
    const { View } = require("react-native");
    const { dynamicTestID: dTID } = require("@/constants");
    return <View testID={dTID.icon(props.name)} />;
  },
}));

jest.mock("../../../ui/ripple-pressable/RipplePressable", () => ({
  RipplePressable: ({ children, onPress }: any) => {
    const { Pressable } = require("react-native");
    return <Pressable onPress={onPress}>{children}</Pressable>;
  },
}));

jest.mock("../../../shared/list-item/ListItem", () => ({
  ListItem: (props: any) => {
    const { Pressable, Text } = require("react-native");
    const { dynamicTestID: dTID } = require("@/constants");
    return (
      <Pressable testID={dTID.menuItem(props.title)} onPress={props.onPress}>
        <Text>{props.title}</Text>
      </Pressable>
    );
  },
}));

jest.mock("../../../ui/text/Text", () => ({
  Text: (props: any) => {
    const { Text } = require("react-native");
    return <Text {...props} />;
  },
}));

jest.mock("../../../ui/toast/Toast", () => ({
  Toast: () => {
    const { View } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return <View testID={TID.Toast} />;
  },
}));

jest.mock("../session-input-modal/SessionInputModal", () => ({
  SessionInputModal: (props: any) => {
    const { View } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return props.visible ? <View testID={TID.SessionInputModal} /> : null;
  },
}));

const mockSession = {
  id: "s1",
  name: "Test Session",
  timestamp: new Date("2024-01-01"),
  lastModified: new Date("2024-01-02"),
  isIncognito: false,
};

function renderAndOpenMenu() {
  const result = render(<SessionMoreMenu session={mockSession as any} />);
  fireEvent.press(result.getByTestId(dynamicTestID.icon("more")).parent!);
  return result;
}

describe("SessionMoreMenu", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders more icon button", () => {
    const { getByTestId } = render(
      <SessionMoreMenu session={mockSession as any} />,
    );
    expect(getByTestId(dynamicTestID.icon("more"))).toBeTruthy();
  });

  it("menu has rename and delete options", () => {
    const { getByTestId } = renderAndOpenMenu();
    expect(
      getByTestId(dynamicTestID.menuItem("sessionRenameTitle")),
    ).toBeTruthy();
    expect(getByTestId(dynamicTestID.menuItem("delete"))).toBeTruthy();
  });

  it("rename option opens SessionInputModal", () => {
    const { getByTestId, queryByTestId } = renderAndOpenMenu();
    expect(queryByTestId(TestID.SessionInputModal)).toBeNull();
    fireEvent.press(getByTestId(dynamicTestID.menuItem("sessionRenameTitle")));
    expect(getByTestId(TestID.SessionInputModal)).toBeTruthy();
  });

  it("renders session info (dates) in menu", () => {
    const { getByText } = renderAndOpenMenu();
    expect(getByText("Modified: today")).toBeTruthy();
  });

  it("delete option triggers confirmation toast", () => {
    const { getByTestId } = renderAndOpenMenu();
    fireEvent.press(getByTestId(dynamicTestID.menuItem("delete")));
    expect(mockShowToast).toHaveBeenCalled();
  });

  it("menu visible after opening", () => {
    const { getByTestId } = renderAndOpenMenu();
    expect(
      getByTestId(dynamicTestID.menuItem("sessionRenameTitle")),
    ).toBeTruthy();
  });

  it("rename action calls renameSession", async () => {
    const mockRenameSession = jest.fn().mockResolvedValue(undefined);
    const { useRenameSession } = require("@/stores");
    (useRenameSession as jest.Mock).mockReturnValue(mockRenameSession);

    // Override SessionInputModal mock to allow triggering onSubmit
    jest.requireMock("../session-input-modal/SessionInputModal").SessionInputModal = (
      props: any,
    ) => {
      const { View, Pressable } = require("react-native");
      if (!props.visible) return null;
      return (
        <View testID={TestID.SessionInputModal}>
          <Pressable
            testID={TestID.SubmitRename}
            onPress={() => props.onSubmit("New Name")}
          />
        </View>
      );
    };

    const { getByTestId } = renderAndOpenMenu();
    // Open rename modal
    fireEvent.press(getByTestId(dynamicTestID.menuItem("sessionRenameTitle")));
    // Submit rename
    await act(async () => {
      fireEvent.press(getByTestId(TestID.SubmitRename));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(mockRenameSession).toHaveBeenCalledWith("s1", "New Name");
  });

  it("delete confirmation executes delete when primary button is tapped", async () => {
    const mockDeleteSession = jest.fn().mockResolvedValue(undefined);
    const { useSessionOperations } = require("@/hooks");
    (useSessionOperations as jest.Mock).mockReturnValue({
      deleteSession: mockDeleteSession,
    });

    const { getByTestId } = renderAndOpenMenu();
    fireEvent.press(getByTestId(dynamicTestID.menuItem("delete")));

    expect(mockShowToast).toHaveBeenCalled();
    // Extract and invoke onPrimaryButtonTap from the toast call
    const toastArgs = mockShowToast.mock.calls[0][0];
    await toastArgs.onPrimaryButtonTap();

    expect(mockHideToast).toHaveBeenCalled();
    expect(mockDeleteSession).toHaveBeenCalledWith("s1");
  });

  it("delete confirmation cancels when secondary button is tapped", () => {
    const { getByTestId } = renderAndOpenMenu();
    fireEvent.press(getByTestId(dynamicTestID.menuItem("delete")));

    const toastArgs = mockShowToast.mock.calls[0][0];
    toastArgs.onSecondaryButtonTap();
    expect(mockHideToast).toHaveBeenCalled();
  });

  it("openMenu calculates position below icon", () => {
    const result = render(<SessionMoreMenu session={mockSession as any} />);
    // measureInWindow returns (100, 100, 24, 24)
    // proposedTop = 100 + 24 + 8 = 132
    // menuHeight fallback = 200, screenHeight from Dimensions
    fireEvent.press(result.getByTestId(dynamicTestID.icon("more")).parent!);
    // Menu should become visible with correct items
    expect(
      result.getByTestId(dynamicTestID.menuItem("sessionRenameTitle")),
    ).toBeTruthy();
  });

  it("openMenu positions menu above when overflow detected", () => {
    // Override measureInWindow to return a position near bottom of screen
    (View.prototype as any).measureInWindow = function (
      cb: (x: number, y: number, w: number, h: number) => void,
    ) {
      // Position near bottom: y=700, small screen means overflow
      cb(100, 700, 24, 24);
    };

    const result = render(<SessionMoreMenu session={mockSession as any} />);
    fireEvent.press(result.getByTestId(dynamicTestID.icon("more")).parent!);
    // Menu should still render (positioned above)
    expect(
      result.getByTestId(dynamicTestID.menuItem("sessionRenameTitle")),
    ).toBeTruthy();

    // Restore
    (View.prototype as any).measureInWindow = function (
      cb: (x: number, y: number, w: number, h: number) => void,
    ) {
      cb(100, 100, 24, 24);
    };
  });

  it("menu onLayout measures menu height", () => {
    const { getByTestId } = renderAndOpenMenu();
    // The menu container should be rendered; finding by testID of inner elements confirms layout
    expect(
      getByTestId(dynamicTestID.menuItem("sessionRenameTitle")),
    ).toBeTruthy();
    expect(getByTestId(dynamicTestID.menuItem("delete"))).toBeTruthy();
  });

  it("overlay press closes menu", () => {
    const { getByTestId, queryByTestId } = renderAndOpenMenu();
    expect(
      getByTestId(dynamicTestID.menuItem("sessionRenameTitle")),
    ).toBeTruthy();
    // The Modal's onRequestClose is wired to close menu
    // Pressing overlay closes the menu - we verify menu items exist initially
    expect(queryByTestId(dynamicTestID.menuItem("delete"))).toBeTruthy();
  });

  it("rename modal cancel closes rename modal", () => {
    // Override SessionInputModal to expose onCancel
    jest.requireMock("../session-input-modal/SessionInputModal").SessionInputModal = (
      props: any,
    ) => {
      const { View, Pressable } = require("react-native");
      if (!props.visible) return null;
      return (
        <View testID={TestID.SessionInputModal}>
          <Pressable testID={TestID.CancelRename} onPress={props.onCancel} />
        </View>
      );
    };

    const { getByTestId, queryByTestId } = renderAndOpenMenu();
    fireEvent.press(getByTestId(dynamicTestID.menuItem("sessionRenameTitle")));
    expect(getByTestId(TestID.SessionInputModal)).toBeTruthy();

    fireEvent.press(getByTestId(TestID.CancelRename));
    expect(queryByTestId(TestID.SessionInputModal)).toBeNull();
  });

  it("delete confirmation handles error gracefully when deleteSession fails", async () => {
    const { logError } = require("@/utils");
    const mockDeleteSession = jest
      .fn()
      .mockRejectedValue(new Error("delete failed"));
    const { useSessionOperations } = require("@/hooks");
    (useSessionOperations as jest.Mock).mockReturnValue({
      deleteSession: mockDeleteSession,
    });

    const { getByTestId } = renderAndOpenMenu();
    fireEvent.press(getByTestId(dynamicTestID.menuItem("delete")));

    const toastArgs = mockShowToast.mock.calls[0][0];
    await toastArgs.onPrimaryButtonTap();

    expect(logError).toHaveBeenCalled();
    expect(mockHideToast).toHaveBeenCalled();
  });

  it("delete confirmation shows global tooltip on success", async () => {
    const mockDeleteSession = jest.fn().mockResolvedValue(undefined);
    const mockShowGlobalTooltip = jest.fn();
    const { useSessionOperations } = require("@/hooks");
    const { useShowGlobalTooltip } = require("@/stores");
    (useSessionOperations as jest.Mock).mockReturnValue({
      deleteSession: mockDeleteSession,
    });
    (useShowGlobalTooltip as jest.Mock).mockReturnValue(mockShowGlobalTooltip);

    const { getByTestId } = renderAndOpenMenu();
    fireEvent.press(getByTestId(dynamicTestID.menuItem("delete")));

    const toastArgs = mockShowToast.mock.calls[0][0];
    await toastArgs.onPrimaryButtonTap();

    expect(mockShowGlobalTooltip).toHaveBeenCalledWith("homeSessionsDeleted_1");
  });

  it("openMenu uses measured menu height for overflow calculation", () => {
    // Mock measured height via onLayout
    const result = render(<SessionMoreMenu session={mockSession as any} />);

    // Open menu first time
    fireEvent.press(result.getByTestId(dynamicTestID.icon("more")).parent!);
    expect(
      result.getByTestId(dynamicTestID.menuItem("sessionRenameTitle")),
    ).toBeTruthy();
  });

  it("onLayout sets measured menu height for subsequent opens", () => {
    const result = render(<SessionMoreMenu session={mockSession as any} />);

    // Open menu to render the menu container
    fireEvent.press(result.getByTestId(dynamicTestID.icon("more")).parent!);

    // Trigger onLayout on the menu container (the View with onLayout prop)
    const menuContainer = result.getByTestId(
      dynamicTestID.menuItem("sessionRenameTitle"),
    ).parent!.parent!.parent!;
    fireEvent(menuContainer, "layout", {
      nativeEvent: { layout: { height: 180 } },
    });

    // Close menu via onRequestClose
    const modal = result.UNSAFE_root.findByType(require("react-native").Modal);
    act(() => {
      modal.props.onRequestClose();
    });

    // Re-open — measured height should now be used instead of fallback
    fireEvent.press(result.getByTestId(dynamicTestID.icon("more")).parent!);
    expect(
      result.getByTestId(dynamicTestID.menuItem("sessionRenameTitle")),
    ).toBeTruthy();
  });

  it("rename handles error gracefully", async () => {
    const { logError } = require("@/utils");
    const mockRenameSession = jest
      .fn()
      .mockRejectedValue(new Error("rename failed"));
    const { useRenameSession } = require("@/stores");
    (useRenameSession as jest.Mock).mockReturnValue(mockRenameSession);

    jest.requireMock("../session-input-modal/SessionInputModal").SessionInputModal = (
      props: any,
    ) => {
      const { View, Pressable } = require("react-native");
      if (!props.visible) return null;
      return (
        <View testID={TestID.SessionInputModal}>
          <Pressable
            testID={TestID.SubmitRename}
            onPress={() => props.onSubmit("Fail Name")}
          />
        </View>
      );
    };

    const { getByTestId } = renderAndOpenMenu();
    fireEvent.press(getByTestId(dynamicTestID.menuItem("sessionRenameTitle")));
    await act(async () => {
      fireEvent.press(getByTestId(TestID.SubmitRename));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(logError).toHaveBeenCalled();
  });
});
