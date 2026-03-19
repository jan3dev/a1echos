import { act, render, waitFor } from "@testing-library/react-native";
import React from "react";

import { useFindSessionById, useIsTranscriptionSelectionMode } from "@/stores";

import SessionScreen from "./[id]";

// --- Mocks ---

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);
jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    canGoBack: mockCanGoBack,
    push: jest.fn(),
  }),
  useLocalSearchParams: () => ({ id: "session-1" }),
}));

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (cb: any) => {
    cb();
  },
  useNavigation: jest.fn(() => ({
    addListener: jest.fn(() => jest.fn()),
  })),
}));

jest.mock("@/theme", () => ({
  useTheme: jest.fn(() => ({
    theme: {
      colors: {
        surfaceBackground: "#fff",
        surfacePrimary: "#fff",
        textPrimary: "#000",
        textSecondary: "#666",
        textInverse: "#fff",
      },
    },
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { mockMakeLoc } = require("../../../test-utils/mockLocalization");

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
  FeatureFlag: {
    recording: "recording",
    session: "session",
    transcription: "transcription",
  },
}));

jest.mock("@/services", () => ({
  shareService: { shareTranscriptions: jest.fn() },
}));

const mockEmptySet = new Set();
const mockSwitchSession = jest.fn();
const mockShowToast = jest.fn();
const mockRenameSession = jest.fn();
const mockExitSelectionMode = jest.fn();
const mockSetRecordingCallbacks = jest.fn();
const mockSetRecordingControlsEnabled = jest.fn();
let mockSession: any = {
  id: "session-1",
  name: "Test Session",
  isIncognito: false,
};

jest.mock("@/stores", () => ({
  useFindSessionById: jest.fn(
    () => (id: string) => (id === "session-1" ? mockSession : null),
  ),
  useRenameSession: jest.fn(() => mockRenameSession),
  useSwitchSession: jest.fn(() => mockSwitchSession),
  useSelectedModelType: jest.fn(() => "whisper_file"),
  useIsRecording: jest.fn(() => false),
  useStartRecording: jest.fn(() => jest.fn()),
  useStopRecordingAndSave: jest.fn(() => jest.fn()),
  useShowToast: jest.fn(() => mockShowToast),
  useShowGlobalTooltip: jest.fn(() => jest.fn()),
  useSessionTranscriptions: jest.fn(() => []),
  useLivePreview: jest.fn(() => null),
  useSetRecordingCallbacks: jest.fn(() => mockSetRecordingCallbacks),
  useSetRecordingControlsEnabled: jest.fn(
    () => mockSetRecordingControlsEnabled,
  ),
  useSetRecordingControlsVisible: jest.fn(() => jest.fn()),
  useSessionStore: jest.fn((sel?: any) => {
    const s = { sessions: [] };
    return sel ? sel(s) : s;
  }),
  useIncognitoSession: jest.fn(() => null),
  useIsTranscriptionSelectionMode: jest.fn(() => false),
  useSelectedTranscriptionIdsSet: jest.fn(() => mockEmptySet),
  useToggleTranscriptionSelection: jest.fn(() => jest.fn()),
  useSelectAllTranscriptions: jest.fn(() => jest.fn()),
  useExitTranscriptionSelection: jest.fn(() => mockExitSelectionMode),
  useDeleteTranscriptions: jest.fn(() => jest.fn()),
}));

let mockOnTitlePressed: (() => void) | null = null;
let mockOnRenameSubmit: ((name: string) => void) | null = null;
const mockShowDeleteToast = jest.fn();
const mockHideDeleteToast = jest.fn();

jest.mock("@/components", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text, TouchableOpacity } = require("react-native");
  return {
    SessionAppBar: (props: any) => {
      mockOnTitlePressed = props.onTitlePressed;
      return (
        <View testID="session-app-bar">
          <Text testID="session-name">{props.sessionName}</Text>
          <Text testID="selection-mode">
            {props.selectionMode ? "selection" : "normal"}
          </Text>
        </View>
      );
    },
    SessionInputModal: (props: any) => {
      mockOnRenameSubmit = props.onSubmit;
      return props.visible ? (
        <View testID="rename-modal">
          <Text>{String(props.title)}</Text>
        </View>
      ) : null;
    },
    TranscriptionContentView: (props: any) => (
      <View testID="transcription-content" />
    ),
    Button: {
      primary: (props: any) => (
        <TouchableOpacity testID="share-button" onPress={props.onPress}>
          <Text>{String(props.text)}</Text>
        </TouchableOpacity>
      ),
    },
    Toast: (props: any) => <View testID="toast" />,
    useToast: jest.fn(() => ({
      show: mockShowDeleteToast,
      hide: mockHideDeleteToast,
      toastState: { visible: false },
    })),
  };
});

beforeEach(() => {
  mockSession = {
    id: "session-1",
    name: "Test Session",
    isIncognito: false,
  };
  mockOnTitlePressed = null;
  mockOnRenameSubmit = null;
  mockSwitchSession.mockResolvedValue(undefined);
});

describe("SessionScreen", () => {
  it("renders SessionAppBar with session name", async () => {
    const { getByTestId } = render(<SessionScreen />);
    expect(getByTestId("session-app-bar")).toBeTruthy();
    expect(getByTestId("session-name")).toHaveTextContent("Test Session");
    await act(async () => {});
  });

  it("shows TranscriptionContentView after initialization", async () => {
    const { getByTestId } = render(<SessionScreen />);
    await waitFor(() => {
      expect(getByTestId("transcription-content")).toBeTruthy();
    });
    expect(mockSwitchSession).toHaveBeenCalledWith("session-1");
  });

  it("missing session navigates back", async () => {
    mockSession = null;
    (useFindSessionById as jest.Mock).mockReturnValue(() => null);

    render(<SessionScreen />);
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalled();
    });
    expect(mockBack).toHaveBeenCalled();
  });

  it("selection mode shows share button", async () => {
    (useIsTranscriptionSelectionMode as jest.Mock).mockReturnValue(true);
    const { getByTestId } = render(<SessionScreen />);
    expect(getByTestId("share-button")).toBeTruthy();
    expect(getByTestId("selection-mode")).toHaveTextContent("selection");
    await act(async () => {});
  });

  it("title press opens rename modal for non-incognito", async () => {
    const { queryByTestId } = render(<SessionScreen />);
    expect(queryByTestId("rename-modal")).toBeNull();

    await act(async () => {
      mockOnTitlePressed!();
    });

    await waitFor(() => {
      expect(queryByTestId("rename-modal")).toBeTruthy();
    });
  });

  it("title press does NOT open rename modal for incognito", async () => {
    mockSession = {
      id: "session-1",
      name: "Incognito",
      isIncognito: true,
    };
    (useFindSessionById as jest.Mock).mockReturnValue(
      (id: string) => mockSession,
    );

    const { queryByTestId } = render(<SessionScreen />);

    await act(async () => {
      mockOnTitlePressed!();
    });

    expect(queryByTestId("rename-modal")).toBeNull();
  });

  it("rename modal submit calls renameSession", async () => {
    const { queryByTestId } = render(<SessionScreen />);

    // Open modal
    await act(async () => {
      mockOnTitlePressed!();
    });
    await waitFor(() => {
      expect(queryByTestId("rename-modal")).toBeTruthy();
    });

    // Submit rename
    await act(async () => {
      mockOnRenameSubmit!("New Name");
    });

    await waitFor(() => {
      expect(mockRenameSession).toHaveBeenCalledWith("session-1", "New Name");
    });
  });

  it("unmount calls exitSelectionMode cleanup", async () => {
    const { unmount } = render(<SessionScreen />);
    await act(async () => {});
    unmount();
    expect(mockExitSelectionMode).toHaveBeenCalled();
  });
});
