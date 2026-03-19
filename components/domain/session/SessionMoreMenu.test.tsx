/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { View } from "react-native";

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

jest.mock("../../ui/toast/useToast", () => ({
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

jest.mock("../../ui/icon/Icon", () => ({
  Icon: (props: any) => {
    const { View } = require("react-native");
    return <View testID={`icon-${props.name}`} />;
  },
}));

jest.mock("../../ui/ripple-pressable/RipplePressable", () => ({
  RipplePressable: ({ children, onPress }: any) => {
    const { Pressable } = require("react-native");
    return <Pressable onPress={onPress}>{children}</Pressable>;
  },
}));

jest.mock("../../shared/list-item/ListItem", () => ({
  ListItem: (props: any) => {
    const { Pressable, Text } = require("react-native");
    return (
      <Pressable testID={`menu-item-${props.title}`} onPress={props.onPress}>
        <Text>{props.title}</Text>
      </Pressable>
    );
  },
}));

jest.mock("../../ui/text/Text", () => ({
  Text: (props: any) => {
    const { Text } = require("react-native");
    return <Text {...props} />;
  },
}));

jest.mock("../../ui/toast/Toast", () => ({
  Toast: () => {
    const { View } = require("react-native");
    return <View testID="toast" />;
  },
}));

jest.mock("./SessionInputModal", () => ({
  SessionInputModal: (props: any) => {
    const { View } = require("react-native");
    return props.visible ? <View testID="session-input-modal" /> : null;
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
  fireEvent.press(result.getByTestId("icon-more").parent!);
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
    expect(getByTestId("icon-more")).toBeTruthy();
  });

  it("menu has rename and delete options", () => {
    const { getByTestId } = renderAndOpenMenu();
    expect(getByTestId("menu-item-sessionRenameTitle")).toBeTruthy();
    expect(getByTestId("menu-item-delete")).toBeTruthy();
  });

  it("rename option opens SessionInputModal", () => {
    const { getByTestId, queryByTestId } = renderAndOpenMenu();
    expect(queryByTestId("session-input-modal")).toBeNull();
    fireEvent.press(getByTestId("menu-item-sessionRenameTitle"));
    expect(getByTestId("session-input-modal")).toBeTruthy();
  });

  it("renders session info (dates) in menu", () => {
    const { getByText } = renderAndOpenMenu();
    expect(getByText("Modified: today")).toBeTruthy();
  });

  it("delete option triggers confirmation toast", () => {
    const { getByTestId } = renderAndOpenMenu();
    fireEvent.press(getByTestId("menu-item-delete"));
    expect(mockShowToast).toHaveBeenCalled();
  });

  it("menu visible after opening", () => {
    const { getByTestId } = renderAndOpenMenu();
    expect(getByTestId("menu-item-sessionRenameTitle")).toBeTruthy();
  });
});
