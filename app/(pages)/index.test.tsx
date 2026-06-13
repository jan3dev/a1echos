/* eslint-disable @typescript-eslint/no-require-imports */
import { act, render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";
import { useIsSessionSelectionMode } from "@/stores";

import HomeScreen from "./index";

// --- Mocks ---

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (cb: any) => {
    cb();
  },
}));

jest.mock("@/theme", () => ({
  useTheme: jest.fn(() => ({
    theme: {
      colors: {
        surfaceBackground: "#fff",
        surfacePrimary: "#fff",
        textPrimary: "#000",
      },
    },
  })),
}));

const {
  mockMakeLoc,
} = require("../../src/test-utils/mock-localization/mockLocalization");

jest.mock("@/hooks", () => ({
  useLocalization: jest.fn(() => ({ loc: mockMakeLoc() })),
  useMicPermission: jest.fn(() => jest.fn(async () => true)),
  usePermissions: jest.fn(() => ({
    hasPermission: true,
    requestPermission: jest.fn(),
    openSettings: jest.fn(),
  })),
  useSessionOperations: jest.fn(() => ({
    deleteSession: jest.fn(),
    endIncognitoSession: jest.fn(),
  })),
}));

jest.mock("@/utils", () => ({
  logError: jest.fn(),
  FeatureFlag: { recording: "recording", session: "session" },
}));

const mockEmptySet = new Set();
const mockSetRecordingCallbacks = jest.fn();
const mockSetRecordingControlsEnabled = jest.fn();
const mockExitSessionSelection = jest.fn();
const mockToggleSessionSelection = jest.fn();
const mockShowDeleteToast = jest.fn();
const mockHideDeleteToast = jest.fn();

let mockSessions: any[] = [];

jest.mock("@/stores", () => ({
  useSessions: jest.fn(() => mockSessions),
  useIncognitoSession: jest.fn(() => null),
  useCreateSession: jest.fn(() => jest.fn()),
  useIsIncognitoMode: jest.fn(() => false),
  useIsSessionSelectionMode: jest.fn(() => false),
  useRenameSession: jest.fn(() => jest.fn()),
  useSelectedSessionIds: jest.fn(() => []),
  useSelectedSessionIdsSet: jest.fn(() => mockEmptySet),
  useToggleSessionSelection: jest.fn(() => mockToggleSessionSelection),
  useExitSessionSelection: jest.fn(() => mockExitSessionSelection),
  useShowGlobalTooltip: jest.fn(() => jest.fn()),
  useSetRecordingCallbacks: jest.fn(() => mockSetRecordingCallbacks),
  useSetRecordingControlsEnabled: jest.fn(
    () => mockSetRecordingControlsEnabled,
  ),
  useSetRecordingControlsVisible: jest.fn(() => jest.fn()),
  useStartRecording: jest.fn(() => jest.fn()),
  useStopRecordingAndSave: jest.fn(() => jest.fn()),
}));

let mockOnSessionTap: ((id: string) => void) | null = null;
let mockOnRenameSubmit: ((name: string) => void) | null = null;
let mockOnRenameCancel: (() => void) | null = null;
const navbarActions: Record<string, () => void> = {};
const navbarActionDisabled: Record<string, boolean> = {};

jest.mock("@/components", () => {
  const { View, Text, TouchableOpacity } = require("react-native");
  const { TestID: TID } = require("@/constants");
  return {
    AppBarBlurTarget: ({ children }: any) => <View>{children}</View>,
    HomeAppBar: () => <View testID={TID.HomeAppBar} />,
    HomeContent: (props: any) => {
      mockOnSessionTap = props.onSessionTap;
      return (
        <View testID={TID.HomeContent}>
          <Text testID={TID.HomeContentSelection}>
            {props.selectionMode ? "selection" : "normal"}
          </Text>
        </View>
      );
    },
    EmptyStateView: ({ message }: any) => (
      <View testID={TID.EmptyStateView}>
        <Text>{String(message)}</Text>
      </View>
    ),
    Screen: ({ children }: any) => <View>{children}</View>,
    SessionActionsSheet: (props: any) =>
      props.visible ? (
        <View testID={TID.SessionActionsSheet} {...props} />
      ) : null,
    SessionInputModal: (props: any) => {
      mockOnRenameSubmit = props.onSubmit;
      mockOnRenameCancel = props.onCancel;
      return props.visible ? (
        <View testID={TID.SessionInputModal} {...props} />
      ) : null;
    },
    SubScreenNavbar: (props: any) => {
      Object.keys(navbarActions).forEach((k) => delete navbarActions[k]);
      Object.keys(navbarActionDisabled).forEach(
        (k) => delete navbarActionDisabled[k],
      );
      (props.actions ?? []).forEach((a: any) => {
        navbarActions[a.key] = a.onPress;
        navbarActionDisabled[a.key] = !!a.disabled;
      });
      if (!props.visible) return null;
      return (
        <View testID={TID.SelectionMode}>
          {(props.actions ?? []).map((a: any) => (
            <TouchableOpacity
              key={a.key}
              testID={`navbar-${a.key}`}
              onPress={a.disabled ? undefined : a.onPress}
              disabled={a.disabled}
            >
              <Text>{String(a.label)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    },
    Toast: (props: any) => <View testID={TID.DeleteToast} {...props} />,
    useToast: jest.fn(() => ({
      show: mockShowDeleteToast,
      hide: mockHideDeleteToast,
      toastState: { visible: false },
    })),
  };
});

beforeEach(() => {
  mockSessions = [];
  mockOnSessionTap = null;
  mockOnRenameSubmit = null;
  mockOnRenameCancel = null;
});

describe("HomeScreen", () => {
  it("renders HomeAppBar and HomeContent", () => {
    const { getByTestId } = render(<HomeScreen />);
    expect(getByTestId(TestID.HomeAppBar)).toBeTruthy();
    expect(getByTestId(TestID.HomeContent)).toBeTruthy();
  });

  it("shows EmptyStateView when sessions empty", () => {
    mockSessions = [];
    const { getByTestId } = render(<HomeScreen />);
    expect(getByTestId(TestID.EmptyStateView)).toBeTruthy();
  });

  it("hides EmptyStateView when sessions exist", () => {
    mockSessions = [{ id: "s1", name: "Session 1" }];
    const { queryByTestId } = render(<HomeScreen />);
    expect(queryByTestId(TestID.EmptyStateView)).toBeNull();
  });

  it("session tap navigates to session detail", () => {
    mockSessions = [{ id: "s1", name: "Session 1" }];
    render(<HomeScreen />);
    expect(mockOnSessionTap).toBeTruthy();
    mockOnSessionTap!("s1");
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/session/[id]",
      params: { id: "s1" },
    });
  });

  it("shows sub-screen navbar in selection mode", () => {
    (useIsSessionSelectionMode as jest.Mock).mockReturnValue(true);
    const { getByTestId } = render(<HomeScreen />);
    expect(getByTestId(TestID.SelectionMode)).toBeTruthy();
    expect(getByTestId(TestID.HomeContentSelection)).toHaveTextContent(
      "selection",
    );
  });

  it("delete selected triggers confirmation toast", () => {
    (useIsSessionSelectionMode as jest.Mock).mockReturnValue(true);
    const { useSelectedSessionIds } = require("@/stores");
    (useSelectedSessionIds as jest.Mock).mockReturnValue(["s1", "s2"]);

    render(<HomeScreen />);
    expect(navbarActions.delete).toBeTruthy();
    navbarActions.delete!();
    expect(mockShowDeleteToast).toHaveBeenCalled();
  });

  it("useFocusEffect sets recording callbacks", () => {
    render(<HomeScreen />);
    expect(mockSetRecordingCallbacks).toHaveBeenCalled();
    expect(mockSetRecordingControlsEnabled).toHaveBeenCalledWith(true);
  });

  it("session tap in selection mode toggles selection instead of navigating", () => {
    (useIsSessionSelectionMode as jest.Mock).mockReturnValue(true);
    mockSessions = [{ id: "s1", name: "Session 1" }];
    render(<HomeScreen />);
    expect(mockOnSessionTap).toBeTruthy();
    mockOnSessionTap!("s1");
    expect(mockToggleSessionSelection).toHaveBeenCalledWith("s1");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("delete selected with no selections does not show toast", () => {
    (useIsSessionSelectionMode as jest.Mock).mockReturnValue(true);
    const { useSelectedSessionIds: useIds } = require("@/stores");
    (useIds as jest.Mock).mockReturnValue([]);

    render(<HomeScreen />);
    expect(navbarActions.delete).toBeTruthy();
    navbarActions.delete!();
    expect(mockShowDeleteToast).not.toHaveBeenCalled();
  });

  it("rename action is disabled when zero sessions selected", () => {
    (useIsSessionSelectionMode as jest.Mock).mockReturnValue(true);
    const { useSelectedSessionIds: useIds } = require("@/stores");
    (useIds as jest.Mock).mockReturnValue([]);

    render(<HomeScreen />);
    expect(navbarActionDisabled.rename).toBe(true);
  });

  it("rename action is disabled when multiple sessions selected", () => {
    (useIsSessionSelectionMode as jest.Mock).mockReturnValue(true);
    const { useSelectedSessionIds: useIds } = require("@/stores");
    (useIds as jest.Mock).mockReturnValue(["s1", "s2"]);

    render(<HomeScreen />);
    expect(navbarActionDisabled.rename).toBe(true);
  });

  it("rename action opens rename modal when exactly one session selected", () => {
    (useIsSessionSelectionMode as jest.Mock).mockReturnValue(true);
    const { useSelectedSessionIds: useIds } = require("@/stores");
    (useIds as jest.Mock).mockReturnValue(["s1"]);
    mockSessions = [{ id: "s1", name: "Session 1" }];

    const { getByTestId, queryByTestId } = render(<HomeScreen />);
    expect(queryByTestId(TestID.SessionInputModal)).toBeNull();
    expect(navbarActionDisabled.rename).toBe(false);

    act(() => {
      navbarActions.rename!();
    });

    expect(getByTestId(TestID.SessionInputModal)).toBeTruthy();
  });

  it("rename action does nothing when selected session id is missing", () => {
    (useIsSessionSelectionMode as jest.Mock).mockReturnValue(true);
    const { useSelectedSessionIds: useIds } = require("@/stores");
    (useIds as jest.Mock).mockReturnValue(["missing"]);
    mockSessions = [{ id: "s1", name: "Session 1" }];

    const { queryByTestId } = render(<HomeScreen />);
    act(() => {
      navbarActions.rename!();
    });
    expect(queryByTestId(TestID.SessionInputModal)).toBeNull();
  });

  it("rename modal cancel closes the modal", () => {
    (useIsSessionSelectionMode as jest.Mock).mockReturnValue(true);
    const { useSelectedSessionIds: useIds } = require("@/stores");
    (useIds as jest.Mock).mockReturnValue(["s1"]);
    mockSessions = [{ id: "s1", name: "Session 1" }];

    const { getByTestId, queryByTestId } = render(<HomeScreen />);
    act(() => {
      navbarActions.rename!();
    });
    expect(getByTestId(TestID.SessionInputModal)).toBeTruthy();

    act(() => {
      mockOnRenameCancel!();
    });
    expect(queryByTestId(TestID.SessionInputModal)).toBeNull();
  });

  it("rename modal submit calls renameSession and exits selection", async () => {
    const mockRename = jest.fn().mockResolvedValue(undefined);
    const { useRenameSession } = require("@/stores");
    (useRenameSession as jest.Mock).mockReturnValue(mockRename);
    (useIsSessionSelectionMode as jest.Mock).mockReturnValue(true);
    const { useSelectedSessionIds: useIds } = require("@/stores");
    (useIds as jest.Mock).mockReturnValue(["s1"]);
    mockSessions = [{ id: "s1", name: "Session 1" }];

    render(<HomeScreen />);
    act(() => {
      navbarActions.rename!();
    });

    await act(async () => {
      await mockOnRenameSubmit!("New Name");
    });

    expect(mockRename).toHaveBeenCalledWith("s1", "New Name");
    expect(mockExitSessionSelection).toHaveBeenCalled();
  });

  it("renders Toast components for delete confirmation and alerts", () => {
    const { getAllByTestId } = render(<HomeScreen />);
    expect(getAllByTestId(TestID.DeleteToast)).toHaveLength(2);
  });

  describe("BackHandler hardwareBackPress", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("returns true and exits selection mode when in selection mode", () => {
      (useIsSessionSelectionMode as jest.Mock).mockReturnValue(true);
      const { BackHandler } = require("react-native");
      const spy = jest.spyOn(BackHandler, "addEventListener");

      render(<HomeScreen />);
      const handler = spy.mock.calls[0]?.[1] as () => boolean;
      const result = handler();
      expect(result).toBe(true);
      expect(mockExitSessionSelection).toHaveBeenCalled();
    });

    it("returns false when not in selection mode", () => {
      (useIsSessionSelectionMode as jest.Mock).mockReturnValue(false);
      const { BackHandler } = require("react-native");
      const spy = jest.spyOn(BackHandler, "addEventListener");

      render(<HomeScreen />);
      const handler = spy.mock.calls[0]?.[1] as () => boolean;
      const result = handler();
      expect(result).toBe(false);
    });
  });
});
