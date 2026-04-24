/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";
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

const { mockMakeLoc } = require("../../test-utils/mockLocalization");

jest.mock("@/hooks", () => ({
  useLocalization: jest.fn(() => ({ loc: mockMakeLoc() })),
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
  useSelectedSessionIds: jest.fn(() => []),
  useSelectedSessionIdsSet: jest.fn(() => mockEmptySet),
  useToggleSessionSelection: jest.fn(() => mockToggleSessionSelection),
  useExitSessionSelection: jest.fn(() => mockExitSessionSelection),
  useShowGlobalTooltip: jest.fn(() => jest.fn()),
  useSetRecordingCallbacks: jest.fn(() => mockSetRecordingCallbacks),
  useSetRecordingControlsEnabled: jest.fn(
    () => mockSetRecordingControlsEnabled,
  ),
  useStartRecording: jest.fn(() => jest.fn()),
  useStopRecordingAndSave: jest.fn(() => jest.fn()),
}));

let mockOnSessionTap: ((id: string) => void) | null = null;
let mockOnDeleteSelected: (() => void) | null = null;

jest.mock("@/components", () => {
  const { View, Text } = require("react-native");
  const { TestID: TID } = require("@/constants");
  return {
    HomeAppBar: (props: any) => {
      mockOnDeleteSelected = props.onDeleteSelected;
      return (
        <View testID={TID.HomeAppBar}>
          <Text testID={TID.HomeAppBarSelection}>
            {props.selectionMode ? "selection" : "normal"}
          </Text>
        </View>
      );
    },
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
  mockOnDeleteSelected = null;
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

  it("passes selection mode props to HomeAppBar", () => {
    (useIsSessionSelectionMode as jest.Mock).mockReturnValue(true);
    const { getByTestId } = render(<HomeScreen />);
    expect(getByTestId(TestID.HomeAppBarSelection)).toHaveTextContent(
      "selection",
    );
    expect(getByTestId(TestID.HomeContentSelection)).toHaveTextContent(
      "selection",
    );
  });

  it("delete selected triggers confirmation toast", () => {
    (useIsSessionSelectionMode as jest.Mock).mockReturnValue(true);
    const { useSelectedSessionIds } = require("@/stores");
    (useSelectedSessionIds as jest.Mock).mockReturnValue(["s1", "s2"]);

    render(<HomeScreen />);
    expect(mockOnDeleteSelected).toBeTruthy();
    mockOnDeleteSelected!();
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
    expect(mockOnDeleteSelected).toBeTruthy();
    mockOnDeleteSelected!();
    expect(mockShowDeleteToast).not.toHaveBeenCalled();
  });

  it("renders Toast component", () => {
    const { getByTestId } = render(<HomeScreen />);
    expect(getByTestId(TestID.DeleteToast)).toBeTruthy();
  });
});
