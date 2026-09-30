/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";

import FolderScreen from "./[id]";

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "f1" }),
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (cb: any) => {
    cb();
  },
}));

jest.mock("@/theme", () => ({
  useTheme: jest.fn(() => ({
    theme: { colors: { textPrimary: "#000", ripple: "#000" } },
  })),
}));

const {
  mockMakeLoc,
} = require("../../../src/test-utils/mock-localization/mockLocalization");

let mockMicGranted = true;
jest.mock("@/hooks", () => ({
  useScrollSurface: jest.fn(() => ({
    scrolled: false,
    onScroll: jest.fn(),
    onContentSizeChange: jest.fn(),
    onLayout: jest.fn(),
  })),
  useLocalization: jest.fn(() => ({ loc: mockMakeLoc() })),
  useRecordingEntry: (...args: any[]) =>
    jest
      .requireActual("@/hooks/use-recording-entry/useRecordingEntry")
      .useRecordingEntry(...args),
  useSessionListActions: (...args: any[]) =>
    jest
      .requireActual("@/hooks/use-session-list-actions/useSessionListActions")
      .useSessionListActions(...args),
}));

jest.mock("@/hooks/use-mic-permission/useMicPermission", () => ({
  useMicPermission: () => async () => mockMicGranted,
}));

jest.mock("@/hooks/use-localization/useLocalization", () => ({
  useLocalization: () => ({ loc: mockMakeLoc() }),
}));
jest.mock("@/hooks/use-session-operations/useSessionOperations", () => ({
  useSessionOperations: () => ({ deleteSession: mockDeleteSession }),
}));

jest.mock("@/utils", () => ({
  logError: jest.fn(),
  getErrorMessage: (e: Error) => e.message,
  FeatureFlag: { recording: "recording" },
}));

let mockSessions: any[] = [];
const mockDeleteSession = jest.fn(async () => undefined);
let mockRecordingStarted = true;
let mockOnStart: (() => Promise<void>) | undefined;
let mockOnStop: (() => Promise<void>) | undefined;
const mockStop = jest.fn();
const mockCreateSession = jest.fn(async () => "s-new");
const mockShowTooltip = jest.fn();
const mockSetVisible = jest.fn();
let mockSelectionMode = false;
let mockSelectedIds: string[] = [];
const mockToggle = jest.fn();
const mockExitSelection = jest.fn();
const mockRename = jest.fn(async () => undefined);

jest.mock("@/stores", () => ({
  useFindFolderById: jest.fn(() => ({ id: "f1", name: "AQUA" })),
  useFolderSessions: jest.fn(() => mockSessions),
  useCreateSession: jest.fn(() => mockCreateSession),
  useIsIncognitoMode: jest.fn(() => false),
  useGlobalTooltip: jest.fn(() => null),
  useShowGlobalTooltip: jest.fn(() => mockShowTooltip),
  useSetRecordingCallbacks: jest.fn(() => (onStart: any, onStop: any) => {
    mockOnStart = onStart;
    mockOnStop = onStop;
  }),
  useSetRecordingControlsEnabled: jest.fn(() => jest.fn()),
  useSetRecordingControlsVisible: jest.fn(() => mockSetVisible),
  useStartRecording: jest.fn(() => async () => mockRecordingStarted),
  useStopRecordingAndSave: jest.fn(() => mockStop),
  useIsSessionSelectionMode: () => mockSelectionMode,
  useSelectedSessionIds: () => mockSelectedIds,
  useSelectedSessionIdsSet: () => new Set(mockSelectedIds),
  useToggleSessionSelection: () => mockToggle,
  useExitSessionSelection: () => mockExitSelection,
  useRenameSession: () => mockRename,
}));

const mockShowToast = jest.fn();
let mockSheet: any = null;
let mockRenameModal: any = null;
let mockNavbar: any = null;
let mockHomeContent: any = null;
jest.mock("@/components", () => {
  const { View, Text, Pressable } = require("react-native");
  return {
    AppBarBlurTarget: ({ children }: any) => <View>{children}</View>,
    EmptyStateView: ({ message }: any) => <Text>{String(message)}</Text>,
    Icon: () => null,
    Screen: ({ children }: any) => <View>{children}</View>,
    HomeContent: (props: any) => {
      mockHomeContent = props;
      return mockSessions.map((session: any) => (
        <View key={session.id}>
          <Pressable
            testID={`row-${session.id}`}
            onPress={() => props.onSessionTap(session.id)}
            onLongPress={() => props.onSessionLongPress(session)}
          >
            <Text>{session.name}</Text>
          </Pressable>
          <Pressable
            testID={`more-${session.id}`}
            onPress={() => props.onSessionMorePress(session)}
          />
        </View>
      ));
    },
    HomeAppBar: ({ selectionTitle }: any) => (
      <Text testID="selection-bar">{selectionTitle}</Text>
    ),
    SessionActionsSheet: (props: any) => {
      mockSheet = props;
      return null;
    },
    SessionInputModal: (props: any) => {
      mockRenameModal = props;
      return null;
    },
    SubScreenNavbar: (props: any) => {
      mockNavbar = props;
      return null;
    },
    Toast: () => null,
    TopAppBar: ({ title, actions }: any) => (
      <View>
        <Text>{title}</Text>
        {actions}
      </View>
    ),
    useToast: () => ({
      show: mockShowToast,
      hide: jest.fn(),
      toastState: {},
    }),
  };
});

jest.mock("@/components/ui/ripple-pressable/RipplePressable", () => {
  const { Pressable } = require("react-native");
  return { RipplePressable: (props: any) => <Pressable {...props} /> };
});

beforeEach(() => {
  mockSessions = [];
  mockRecordingStarted = true;
  mockMicGranted = true;
  mockOnStart = undefined;
  mockSelectionMode = false;
  mockSelectedIds = [];
  mockSheet = null;
  mockRenameModal = null;
  mockNavbar = null;
  mockHomeContent = null;
});

describe("FolderScreen", () => {
  it("shows the folder name and the empty state without sessions", () => {
    const { getByText } = render(<FolderScreen />);
    expect(getByText("AQUA")).toBeTruthy();
    expect(getByText("emptySessionsMessage")).toBeTruthy();
    expect(mockHomeContent.folderId).toBe("f1");
    expect(mockSetVisible).toHaveBeenCalledWith(true);
  });

  it("lists folder sessions and opens one on tap", () => {
    mockSessions = [{ id: "s1", name: "Session 1" }];
    const { getByTestId, queryByText } = render(<FolderScreen />);
    expect(queryByText("emptySessionsMessage")).toBeNull();
    fireEvent.press(getByTestId("row-s1"));
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ params: { id: "s1" } }),
    );
  });

  it("stops recording through the registered stop callback", async () => {
    render(<FolderScreen />);
    await act(async () => {
      await mockOnStop!();
    });
    expect(mockStop).toHaveBeenCalled();
  });

  it("long press enters selection with the pressed session", async () => {
    mockSessions = [{ id: "s1", name: "Session 1" }];
    const { getByTestId } = render(<FolderScreen />);
    await act(async () => {
      fireEvent(getByTestId("row-s1"), "longPress");
    });
    expect(mockToggle).toHaveBeenCalledWith("s1");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("in selection mode swaps the bars, hides recording, and toggles on tap", () => {
    mockSelectionMode = true;
    mockSelectedIds = ["s1"];
    mockSessions = [{ id: "s1", name: "Session 1" }];
    const { getByTestId, queryByText } = render(<FolderScreen />);
    expect(getByTestId("selection-bar")).toHaveTextContent("selectedCount_1");
    expect(queryByText("AQUA")).toBeNull();
    expect(mockHomeContent.selectionMode).toBe(true);
    expect(mockNavbar.visible).toBe(true);
    expect(mockSetVisible).toHaveBeenLastCalledWith(false);
    fireEvent.press(getByTestId("row-s1"));
    expect(mockToggle).toHaveBeenCalledWith("s1");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("navbar rename renames the single selected session and exits selection", async () => {
    mockSelectionMode = true;
    mockSelectedIds = ["s1"];
    mockSessions = [{ id: "s1", name: "Session 1" }];
    render(<FolderScreen />);
    act(() =>
      mockNavbar.actions.find((a: any) => a.key === "rename").onPress(),
    );
    expect(mockRenameModal.visible).toBe(true);
    await act(async () => {
      await mockRenameModal.onSubmit("Renamed");
    });
    expect(mockRename).toHaveBeenCalledWith("s1", "Renamed");
    expect(mockExitSelection).toHaveBeenCalled();
  });

  it("navbar delete asks for confirmation", () => {
    mockSelectionMode = true;
    mockSelectedIds = ["s1"];
    mockSessions = [{ id: "s1", name: "Session 1" }];
    render(<FolderScreen />);
    act(() =>
      mockNavbar.actions.find((a: any) => a.key === "delete").onPress(),
    );
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "info" }),
    );
  });

  it("⋯ menu opens the actions sheet with rename and delete", () => {
    mockSessions = [{ id: "s1", name: "Session 1" }];
    const { getByTestId } = render(<FolderScreen />);
    act(() => fireEvent.press(getByTestId("more-s1")));
    expect(mockSheet.visible).toBe(true);
    expect(mockSheet.title).toBe("Session 1");

    act(() => mockSheet.onRename());
    expect(mockSheet.visible).toBe(false);
    expect(mockRenameModal.visible).toBe(true);
    expect(mockRenameModal.initialValue).toBe("Session 1");
    act(() => mockRenameModal.onCancel());
    expect(mockRenameModal.visible).toBe(false);

    act(() => fireEvent.press(getByTestId("more-s1")));
    act(() => mockSheet.onDelete());
    expect(mockShowToast).toHaveBeenCalled();

    act(() => fireEvent.press(getByTestId("more-s1")));
    act(() => mockSheet.onDismiss());
    expect(mockSheet.visible).toBe(false);
  });

  it("confirming delete removes the session and reports it", async () => {
    mockSelectionMode = true;
    mockSelectedIds = ["s1"];
    mockSessions = [{ id: "s1", name: "Session 1" }];
    render(<FolderScreen />);
    act(() =>
      mockNavbar.actions.find((a: any) => a.key === "delete").onPress(),
    );
    const toast = mockShowToast.mock.calls.at(-1)[0];
    await act(async () => {
      await toast.onPrimaryButtonTap();
    });
    expect(mockDeleteSession).toHaveBeenCalledWith("s1");
    expect(mockExitSelection).toHaveBeenCalled();
    expect(mockShowTooltip).toHaveBeenCalledWith("homeSessionsDeleted_1");
  });

  it("exits selection when leaving the folder", () => {
    const { unmount } = render(<FolderScreen />);
    unmount();
    expect(mockExitSelection).toHaveBeenCalled();
  });

  it("closes back to the previous screen", () => {
    const { getByTestId } = render(<FolderScreen />);
    fireEvent.press(getByTestId(TestID.FolderCloseButton));
    expect(mockBack).toHaveBeenCalled();
  });

  it("records into a new session filed in this folder", async () => {
    jest.useFakeTimers();
    render(<FolderScreen />);
    await act(async () => {
      const done = mockOnStart!();
      await jest.runAllTimersAsync();
      await done;
    });
    jest.useRealTimers();
    expect(mockCreateSession).toHaveBeenCalledWith(
      undefined,
      false,
      expect.anything(),
      expect.anything(),
      "f1",
    );
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ params: { id: "s-new" } }),
    );
  });

  it("does nothing without mic permission", async () => {
    mockMicGranted = false;
    render(<FolderScreen />);
    await act(async () => {
      await mockOnStart!();
    });
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("shows a tooltip when recording fails to start", async () => {
    mockRecordingStarted = false;
    render(<FolderScreen />);
    await act(async () => {
      await mockOnStart!();
    });
    expect(mockShowTooltip).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows an error toast when session creation throws", async () => {
    mockCreateSession.mockRejectedValueOnce(new Error("boom"));
    render(<FolderScreen />);
    await act(async () => {
      await mockOnStart!();
    });
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: "boom", variant: "error" }),
    );
  });
});
