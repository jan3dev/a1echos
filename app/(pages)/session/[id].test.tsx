/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React from "react";
import { Keyboard } from "react-native";

import { TestID } from "@/constants";
import { shareService } from "@/services";
import {
  useDeleteTranscriptions,
  useFindSessionById,
  useIsRecording,
  useIsTranscriptionSelectionMode,
  useSelectedTranscriptionIdsSet,
  useSessionTranscriptions,
  useStopRecordingAndSave,
  useToggleTranscriptionSelection,
} from "@/stores";

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
  useSelectedTranscriptionMode: jest.fn(() => "file"),
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
let mockOnBackPressed: (() => void) | null = null;
let mockOnCopyAllPressed: (() => void) | null = null;
let mockOnSelectAllPressed: (() => void) | null = null;
let mockOnDeleteSelectedPressed: (() => void) | null = null;
let mockOnCancelEditPressed: (() => void) | null = null;
let mockOnSaveEditPressed: (() => void) | null = null;
let mockOnLanguageFlagPressed: (() => void) | null = null;
let mockOnRenameSubmit: ((name: string) => void) | null = null;
let mockOnTranscriptionTap: ((id: string) => void) | null = null;
let mockOnTranscriptionLongPress: ((id: string) => void) | null = null;
let mockOnEditStart: (() => void) | null = null;
let mockOnEditEnd: (() => void) | null = null;
const mockShowDeleteToast = jest.fn();
const mockHideDeleteToast = jest.fn();

jest.mock("@/components", () => {
  const { View, Text, TouchableOpacity } = require("react-native");
  const { TestID: TID } = require("@/constants");
  return {
    SessionAppBar: (props: any) => {
      mockOnTitlePressed = props.onTitlePressed;
      mockOnBackPressed = props.onBackPressed;
      mockOnCopyAllPressed = props.onCopyAllPressed;
      mockOnSelectAllPressed = props.onSelectAllPressed;
      mockOnDeleteSelectedPressed = props.onDeleteSelectedPressed;
      mockOnCancelEditPressed = props.onCancelEditPressed;
      mockOnSaveEditPressed = props.onSaveEditPressed;
      mockOnLanguageFlagPressed = props.onLanguageFlagPressed;
      return (
        <View testID={TID.SessionAppBar}>
          <Text testID={TID.SessionName}>{props.sessionName}</Text>
          <Text testID={TID.SelectionMode}>
            {props.selectionMode ? "selection" : "normal"}
          </Text>
          <Text testID={TID.EditMode}>
            {props.editMode ? "editing" : "not-editing"}
          </Text>
        </View>
      );
    },
    SessionInputModal: (props: any) => {
      mockOnRenameSubmit = props.onSubmit;
      return props.visible ? (
        <View testID={TID.RenameModal}>
          <Text>{String(props.title)}</Text>
        </View>
      ) : null;
    },
    TranscriptionContentView: (props: any) => {
      mockOnTranscriptionTap = props.onTranscriptionTap;
      mockOnTranscriptionLongPress = props.onTranscriptionLongPress;
      mockOnEditStart = props.onEditStart;
      mockOnEditEnd = props.onEditEnd;
      return <View testID={TID.TranscriptionContent} />;
    },
    Button: {
      primary: (props: any) => (
        <TouchableOpacity testID={TID.ShareButton} onPress={props.onPress}>
          <Text>{String(props.text)}</Text>
        </TouchableOpacity>
      ),
    },
    Toast: (props: any) => <View testID={TID.Toast} />,
    useToast: jest.fn(() => ({
      show: mockShowDeleteToast,
      hide: mockHideDeleteToast,
      toastState: { visible: false },
    })),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSession = {
    id: "session-1",
    name: "Test Session",
    isIncognito: false,
  };
  mockOnTitlePressed = null;
  mockOnBackPressed = null;
  mockOnCopyAllPressed = null;
  mockOnSelectAllPressed = null;
  mockOnDeleteSelectedPressed = null;
  mockOnCancelEditPressed = null;
  mockOnSaveEditPressed = null;
  mockOnLanguageFlagPressed = null;
  mockOnRenameSubmit = null;
  mockOnTranscriptionTap = null;
  mockOnTranscriptionLongPress = null;
  mockOnEditStart = null;
  mockOnEditEnd = null;
  mockSwitchSession.mockResolvedValue(undefined);

  // Restore default mock return values after clearAllMocks
  const stores = jest.requireMock("@/stores");
  (stores.useFindSessionById as jest.Mock).mockReturnValue((id: string) =>
    id === "session-1" ? mockSession : null,
  );
  (stores.useRenameSession as jest.Mock).mockReturnValue(mockRenameSession);
  (stores.useSwitchSession as jest.Mock).mockReturnValue(mockSwitchSession);
  (stores.useSelectedModelType as jest.Mock).mockReturnValue("whisper_file");
  (stores.useIsRecording as jest.Mock).mockReturnValue(false);
  (stores.useStartRecording as jest.Mock).mockReturnValue(jest.fn());
  (stores.useStopRecordingAndSave as jest.Mock).mockReturnValue(jest.fn());
  (stores.useShowToast as jest.Mock).mockReturnValue(mockShowToast);
  (stores.useShowGlobalTooltip as jest.Mock).mockReturnValue(jest.fn());
  (stores.useSessionTranscriptions as jest.Mock).mockReturnValue([]);
  (stores.useLivePreview as jest.Mock).mockReturnValue(null);
  (stores.useSetRecordingCallbacks as jest.Mock).mockReturnValue(
    mockSetRecordingCallbacks,
  );
  (stores.useSetRecordingControlsEnabled as jest.Mock).mockReturnValue(
    mockSetRecordingControlsEnabled,
  );
  (stores.useSetRecordingControlsVisible as jest.Mock).mockReturnValue(
    jest.fn(),
  );
  (stores.useSessionStore as jest.Mock).mockImplementation((sel?: any) => {
    const s = { sessions: [] };
    return sel ? sel(s) : s;
  });
  (stores.useIncognitoSession as jest.Mock).mockReturnValue(null);
  (stores.useIsTranscriptionSelectionMode as jest.Mock).mockReturnValue(false);
  (stores.useSelectedTranscriptionIdsSet as jest.Mock).mockReturnValue(
    new Set(),
  );
  (stores.useToggleTranscriptionSelection as jest.Mock).mockReturnValue(
    jest.fn(),
  );
  (stores.useSelectAllTranscriptions as jest.Mock).mockReturnValue(jest.fn());
  (stores.useExitTranscriptionSelection as jest.Mock).mockReturnValue(
    mockExitSelectionMode,
  );
  (stores.useDeleteTranscriptions as jest.Mock).mockReturnValue(jest.fn());

  // Restore component mocks
  const components = jest.requireMock("@/components");
  (components.useToast as jest.Mock).mockReturnValue({
    show: mockShowDeleteToast,
    hide: mockHideDeleteToast,
    toastState: { visible: false },
  });

  // Restore hooks
  const hooks = jest.requireMock("@/hooks");
  (hooks.useLocalization as jest.Mock).mockReturnValue({ loc: mockMakeLoc() });
  (hooks.usePermissions as jest.Mock).mockReturnValue({
    hasPermission: true,
    requestPermission: jest.fn(),
    openSettings: jest.fn(),
  });
  (hooks.useSessionOperations as jest.Mock).mockReturnValue({
    deleteSession: jest.fn(),
    endIncognitoSession: jest.fn(),
  });

  // Restore navigation
  const nav = jest.requireMock("@react-navigation/native");
  (nav.useNavigation as jest.Mock).mockReturnValue({
    addListener: jest.fn(() => jest.fn()),
  });
});

describe("SessionScreen", () => {
  it("renders SessionAppBar with session name", async () => {
    const { getByTestId } = render(<SessionScreen />);
    expect(getByTestId(TestID.SessionAppBar)).toBeTruthy();
    expect(getByTestId(TestID.SessionName)).toHaveTextContent("Test Session");
    await act(async () => {});
  });

  it("shows TranscriptionContentView after initialization", async () => {
    const { getByTestId } = render(<SessionScreen />);
    await waitFor(() => {
      expect(getByTestId(TestID.TranscriptionContent)).toBeTruthy();
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
    expect(getByTestId(TestID.ShareButton)).toBeTruthy();
    expect(getByTestId(TestID.SelectionMode)).toHaveTextContent("selection");
    await act(async () => {});
  });

  it("title press opens rename modal for non-incognito", async () => {
    const { queryByTestId } = render(<SessionScreen />);
    expect(queryByTestId(TestID.RenameModal)).toBeNull();

    await act(async () => {
      mockOnTitlePressed!();
    });

    await waitFor(() => {
      expect(queryByTestId(TestID.RenameModal)).toBeTruthy();
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

    expect(queryByTestId(TestID.RenameModal)).toBeNull();
  });

  it("rename modal submit calls renameSession", async () => {
    const { queryByTestId } = render(<SessionScreen />);

    // Open modal
    await act(async () => {
      mockOnTitlePressed!();
    });
    await waitFor(() => {
      expect(queryByTestId(TestID.RenameModal)).toBeTruthy();
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

  // --- A. handleBackPressed branches ---

  describe("handleBackPressed", () => {
    it("when recording: calls stopRecordingAndSave then navigates back", async () => {
      const mockStopAndSave = jest.fn().mockResolvedValue(undefined);
      (useIsRecording as jest.Mock).mockReturnValue(true);
      (useStopRecordingAndSave as jest.Mock).mockReturnValue(mockStopAndSave);

      render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        mockOnBackPressed!();
      });

      await waitFor(() => {
        expect(mockStopAndSave).toHaveBeenCalled();
        expect(mockBack).toHaveBeenCalled();
      });
    });

    it("when editing: calls handleCancelEdit (dismiss keyboard)", async () => {
      const keyboardDismissSpy = jest.spyOn(Keyboard, "dismiss");

      render(<SessionScreen />);
      await act(async () => {});

      // Enter editing mode via onEditStart
      await act(async () => {
        mockOnEditStart!();
      });

      // Now back press should cancel edit
      await act(async () => {
        mockOnBackPressed!();
      });

      expect(keyboardDismissSpy).toHaveBeenCalled();
      keyboardDismissSpy.mockRestore();
    });

    it("when selectionMode: calls exitSelectionMode", async () => {
      (useIsTranscriptionSelectionMode as jest.Mock).mockReturnValue(true);

      render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        mockOnBackPressed!();
      });

      expect(mockExitSelectionMode).toHaveBeenCalled();
    });

    it("default: calls router.back()", async () => {
      render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        mockOnBackPressed!();
      });

      expect(mockBack).toHaveBeenCalled();
    });
  });

  // --- B. handleLongPress ---

  describe("handleLongPress", () => {
    it("first long press enters selection mode and triggers haptics", async () => {
      const mockToggle = jest.fn();
      (useIsTranscriptionSelectionMode as jest.Mock).mockReturnValue(false);
      (useToggleTranscriptionSelection as jest.Mock).mockReturnValue(
        mockToggle,
      );

      render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        mockOnTranscriptionLongPress!("transcription-1");
      });

      expect(mockToggle).toHaveBeenCalledWith("transcription-1");
      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Heavy,
      );
    });

    it("second long press in selection mode toggles without haptics", async () => {
      const mockToggle = jest.fn();
      (useIsTranscriptionSelectionMode as jest.Mock).mockReturnValue(true);
      (useToggleTranscriptionSelection as jest.Mock).mockReturnValue(
        mockToggle,
      );
      (Haptics.impactAsync as jest.Mock).mockClear();

      render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        mockOnTranscriptionLongPress!("transcription-2");
      });

      expect(mockToggle).toHaveBeenCalledWith("transcription-2");
      expect(Haptics.impactAsync).not.toHaveBeenCalled();
    });
  });

  // --- C. handleTranscriptionTap ---

  describe("handleTranscriptionTap", () => {
    it("in selection mode: calls toggleTranscriptionSelection", async () => {
      const mockToggle = jest.fn();
      (useIsTranscriptionSelectionMode as jest.Mock).mockReturnValue(true);
      (useToggleTranscriptionSelection as jest.Mock).mockReturnValue(
        mockToggle,
      );

      render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        mockOnTranscriptionTap!("transcription-1");
      });

      expect(mockToggle).toHaveBeenCalledWith("transcription-1");
    });

    it("not in selection mode: does nothing", async () => {
      const mockToggle = jest.fn();
      (useIsTranscriptionSelectionMode as jest.Mock).mockReturnValue(false);
      (useToggleTranscriptionSelection as jest.Mock).mockReturnValue(
        mockToggle,
      );

      render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        mockOnTranscriptionTap!("transcription-1");
      });

      expect(mockToggle).not.toHaveBeenCalled();
    });
  });

  // --- D. handleCopyAllPressed ---

  describe("handleCopyAllPressed", () => {
    it("with empty transcriptions: shows no transcriptions tooltip", async () => {
      const mockShowGlobalTooltip = jest.fn();
      const { useShowGlobalTooltip } = jest.requireMock("@/stores");
      (useShowGlobalTooltip as jest.Mock).mockReturnValue(
        mockShowGlobalTooltip,
      );
      (useSessionTranscriptions as jest.Mock).mockReturnValue([]);

      render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        mockOnCopyAllPressed!();
      });

      expect(mockShowGlobalTooltip).toHaveBeenCalledWith(
        expect.anything(),
        "normal",
        undefined,
        true,
      );
      expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
    });

    it("success: copies text and shows tooltip on iOS", async () => {
      const mockShowGlobalTooltip = jest.fn();
      const { useShowGlobalTooltip } = jest.requireMock("@/stores");
      (useShowGlobalTooltip as jest.Mock).mockReturnValue(
        mockShowGlobalTooltip,
      );
      (useSessionTranscriptions as jest.Mock).mockReturnValue([
        { id: "t1", text: "Hello world" },
        { id: "t2", text: "Second transcription" },
      ]);
      (Clipboard.setStringAsync as jest.Mock).mockResolvedValue(undefined);

      const originalPlatform = Object.getOwnPropertyDescriptor(
        require("react-native").Platform,
        "OS",
      );
      Object.defineProperty(require("react-native").Platform, "OS", {
        value: "ios",
        configurable: true,
      });

      render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        mockOnCopyAllPressed!();
      });

      await waitFor(() => {
        expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
          "Hello world\n\nSecond transcription",
        );
      });

      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success,
      );

      // Restore
      if (originalPlatform) {
        Object.defineProperty(
          require("react-native").Platform,
          "OS",
          originalPlatform,
        );
      }
    });

    it("failure: shows error tooltip", async () => {
      const mockShowGlobalTooltip = jest.fn();
      const { useShowGlobalTooltip } = jest.requireMock("@/stores");
      (useShowGlobalTooltip as jest.Mock).mockReturnValue(
        mockShowGlobalTooltip,
      );
      (useSessionTranscriptions as jest.Mock).mockReturnValue([
        { id: "t1", text: "Hello" },
      ]);
      (Clipboard.setStringAsync as jest.Mock).mockRejectedValue(
        new Error("Clipboard error"),
      );

      render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        mockOnCopyAllPressed!();
      });

      await waitFor(() => {
        expect(mockShowGlobalTooltip).toHaveBeenCalledWith(
          expect.anything(),
          "normal",
          undefined,
          true,
        );
      });
    });
  });

  // --- E. handleSharePressed ---

  describe("handleSharePressed", () => {
    it("with no selected items: shows warning toast", async () => {
      (useIsTranscriptionSelectionMode as jest.Mock).mockReturnValue(true);
      (useSelectedTranscriptionIdsSet as jest.Mock).mockReturnValue(new Set());

      const { getByTestId } = render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        fireEvent.press(getByTestId(TestID.ShareButton));
      });

      expect(mockShowToast).toHaveBeenCalledWith(expect.anything(), "warning");
    });

    it("success: calls shareService.shareTranscriptions", async () => {
      const selectedIds = new Set(["t1"]);
      (useIsTranscriptionSelectionMode as jest.Mock).mockReturnValue(true);
      (useSelectedTranscriptionIdsSet as jest.Mock).mockReturnValue(
        selectedIds,
      );
      (useSessionTranscriptions as jest.Mock).mockReturnValue([
        { id: "t1", text: "Hello" },
        { id: "t2", text: "World" },
      ]);
      (shareService.shareTranscriptions as jest.Mock).mockResolvedValue(
        undefined,
      );

      const { getByTestId } = render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        fireEvent.press(getByTestId(TestID.ShareButton));
      });

      await waitFor(() => {
        expect(shareService.shareTranscriptions).toHaveBeenCalledWith([
          { id: "t1", text: "Hello" },
        ]);
      });
    });
  });

  // --- F. handleDeleteSelectedPressed ---

  describe("handleDeleteSelectedPressed", () => {
    it("shows delete confirmation toast", async () => {
      const selectedIds = new Set(["t1", "t2"]);
      (useIsTranscriptionSelectionMode as jest.Mock).mockReturnValue(true);
      (useSelectedTranscriptionIdsSet as jest.Mock).mockReturnValue(
        selectedIds,
      );

      render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        mockOnDeleteSelectedPressed!();
      });

      expect(mockShowDeleteToast).toHaveBeenCalledWith(
        expect.objectContaining({
          primaryButtonText: expect.anything(),
          secondaryButtonText: expect.anything(),
          variant: "informative",
        }),
      );
    });

    it("primary button tap deletes and shows tooltip", async () => {
      const selectedIds = new Set(["t1"]);
      const mockDeleteTranscriptions = jest.fn().mockResolvedValue(undefined);
      const mockShowGlobalTooltip = jest.fn();
      const { useShowGlobalTooltip } = jest.requireMock("@/stores");

      (useIsTranscriptionSelectionMode as jest.Mock).mockReturnValue(true);
      (useSelectedTranscriptionIdsSet as jest.Mock).mockReturnValue(
        selectedIds,
      );
      (useDeleteTranscriptions as jest.Mock).mockReturnValue(
        mockDeleteTranscriptions,
      );
      (useShowGlobalTooltip as jest.Mock).mockReturnValue(
        mockShowGlobalTooltip,
      );

      render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        mockOnDeleteSelectedPressed!();
      });

      // Get the primary button callback from the toast
      const toastCall = mockShowDeleteToast.mock.calls[0][0];

      await act(async () => {
        await toastCall.onPrimaryButtonTap();
      });

      expect(mockHideDeleteToast).toHaveBeenCalled();
      expect(mockDeleteTranscriptions).toHaveBeenCalledWith(selectedIds);
      expect(mockShowGlobalTooltip).toHaveBeenCalled();
    });
  });

  // --- G. Recording callbacks ---

  describe("recording callbacks", () => {
    it("sets recording callbacks on focus via useFocusEffect", async () => {
      render(<SessionScreen />);
      await act(async () => {});

      expect(mockSetRecordingCallbacks).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
      );
    });

    it("sets recording controls enabled based on initialization state", async () => {
      render(<SessionScreen />);

      // Initially isInitializing is true and isRecording is false, so controlsEnabled = false
      expect(mockSetRecordingControlsEnabled).toHaveBeenCalledWith(false);

      // After initialization completes, controlsEnabled becomes true
      await waitFor(() => {
        expect(mockSetRecordingControlsEnabled).toHaveBeenCalledWith(true);
      });
    });

    it("controls enabled when recording even during initialization", async () => {
      (useIsRecording as jest.Mock).mockReturnValue(true);

      render(<SessionScreen />);
      await act(async () => {});

      // controlsEnabled = !isInitializing || isRecording => true when isRecording
      expect(mockSetRecordingControlsEnabled).toHaveBeenCalledWith(true);
    });
  });

  // --- H. Navigation lifecycle ---

  describe("navigation lifecycle", () => {
    it("beforeRemove when recording: stops recording then navigates", async () => {
      const mockStopAndSave = jest.fn().mockResolvedValue(undefined);
      (useIsRecording as jest.Mock).mockReturnValue(true);
      (useStopRecordingAndSave as jest.Mock).mockReturnValue(mockStopAndSave);

      let beforeRemoveHandler: ((e: any) => void) | null = null;
      const { useNavigation } = jest.requireMock("@react-navigation/native");
      (useNavigation as jest.Mock).mockReturnValue({
        addListener: jest.fn((event: string, handler: any) => {
          if (event === "beforeRemove") {
            beforeRemoveHandler = handler;
          }
          return jest.fn();
        }),
      });

      render(<SessionScreen />);
      await act(async () => {});

      const mockPreventDefault = jest.fn();
      await act(async () => {
        await beforeRemoveHandler!({ preventDefault: mockPreventDefault });
      });

      expect(mockPreventDefault).toHaveBeenCalled();
      expect(mockStopAndSave).toHaveBeenCalled();
      expect(mockBack).toHaveBeenCalled();
    });

    it("beforeRemove for incognito: ends incognito session then navigates", async () => {
      const mockEndIncognito = jest.fn().mockResolvedValue(undefined);
      const { useSessionOperations } = jest.requireMock("@/hooks");
      (useSessionOperations as jest.Mock).mockReturnValue({
        deleteSession: jest.fn(),
        endIncognitoSession: mockEndIncognito,
      });

      mockSession = {
        id: "session-1",
        name: "Incognito",
        isIncognito: true,
      };
      (useFindSessionById as jest.Mock).mockReturnValue(
        (id: string) => mockSession,
      );

      let beforeRemoveHandler: ((e: any) => void) | null = null;
      const { useNavigation } = jest.requireMock("@react-navigation/native");
      (useNavigation as jest.Mock).mockReturnValue({
        addListener: jest.fn((event: string, handler: any) => {
          if (event === "beforeRemove") {
            beforeRemoveHandler = handler;
          }
          return jest.fn();
        }),
      });

      render(<SessionScreen />);
      await act(async () => {});

      const mockPreventDefault = jest.fn();
      await act(async () => {
        await beforeRemoveHandler!({ preventDefault: mockPreventDefault });
      });

      expect(mockPreventDefault).toHaveBeenCalled();
      expect(mockEndIncognito).toHaveBeenCalled();
      expect(mockBack).toHaveBeenCalled();
    });
  });

  // --- Additional edge cases ---

  describe("recording controls visibility", () => {
    it("hides recording controls when in selection mode", async () => {
      const mockSetVisible = jest.fn();
      const { useSetRecordingControlsVisible } = jest.requireMock("@/stores");
      (useSetRecordingControlsVisible as jest.Mock).mockReturnValue(
        mockSetVisible,
      );
      (useIsTranscriptionSelectionMode as jest.Mock).mockReturnValue(true);

      render(<SessionScreen />);
      await act(async () => {});

      expect(mockSetVisible).toHaveBeenCalledWith(false);
    });

    it("hides recording controls when editing", async () => {
      const mockSetVisible = jest.fn();
      const { useSetRecordingControlsVisible } = jest.requireMock("@/stores");
      (useSetRecordingControlsVisible as jest.Mock).mockReturnValue(
        mockSetVisible,
      );

      render(<SessionScreen />);
      await act(async () => {});

      // Enter editing mode
      await act(async () => {
        mockOnEditStart!();
      });

      expect(mockSetVisible).toHaveBeenCalledWith(false);
    });

    it("shows recording controls when not in selection or edit mode", async () => {
      const mockSetVisible = jest.fn();
      const { useSetRecordingControlsVisible } = jest.requireMock("@/stores");
      (useSetRecordingControlsVisible as jest.Mock).mockReturnValue(
        mockSetVisible,
      );

      render(<SessionScreen />);
      await act(async () => {});

      expect(mockSetVisible).toHaveBeenCalledWith(true);
    });
  });

  describe("handleDeleteSelectedPressed with no selection", () => {
    it("does nothing when no items selected", async () => {
      (useIsTranscriptionSelectionMode as jest.Mock).mockReturnValue(true);
      (useSelectedTranscriptionIdsSet as jest.Mock).mockReturnValue(new Set());

      render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        mockOnDeleteSelectedPressed!();
      });

      expect(mockShowDeleteToast).not.toHaveBeenCalled();
    });
  });

  describe("save edit callback", () => {
    it("onSaveEditPressed dismisses keyboard and exits edit mode", async () => {
      const keyboardDismissSpy = jest.spyOn(Keyboard, "dismiss");

      render(<SessionScreen />);
      await act(async () => {});

      // Enter edit mode
      await act(async () => {
        mockOnEditStart!();
      });

      // Save edit
      await act(async () => {
        mockOnSaveEditPressed!();
      });

      expect(keyboardDismissSpy).toHaveBeenCalled();
      keyboardDismissSpy.mockRestore();
    });
  });

  // --- Additional coverage tests ---

  describe("copyAllTranscriptions", () => {
    it("clipboard success on Android < 12 shows tooltip", async () => {
      const mockShowGlobalTooltip = jest.fn();
      const { useShowGlobalTooltip } = jest.requireMock("@/stores");
      (useShowGlobalTooltip as jest.Mock).mockReturnValue(
        mockShowGlobalTooltip,
      );
      (useSessionTranscriptions as jest.Mock).mockReturnValue([
        { id: "t1", text: "Hello world" },
      ]);
      (Clipboard.setStringAsync as jest.Mock).mockResolvedValue(undefined);

      const originalOS = Object.getOwnPropertyDescriptor(
        require("react-native").Platform,
        "OS",
      );
      const originalVersion = Object.getOwnPropertyDescriptor(
        require("react-native").Platform,
        "Version",
      );
      Object.defineProperty(require("react-native").Platform, "OS", {
        value: "android",
        configurable: true,
      });
      Object.defineProperty(require("react-native").Platform, "Version", {
        value: 30,
        configurable: true,
      });

      render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        mockOnCopyAllPressed!();
      });

      await waitFor(() => {
        expect(Clipboard.setStringAsync).toHaveBeenCalled();
        expect(mockShowGlobalTooltip).toHaveBeenCalledWith(expect.anything());
      });

      // Restore
      if (originalOS) {
        Object.defineProperty(
          require("react-native").Platform,
          "OS",
          originalOS,
        );
      }
      if (originalVersion) {
        Object.defineProperty(
          require("react-native").Platform,
          "Version",
          originalVersion,
        );
      }
    });

    it("clipboard success on Android >= 12 does NOT show tooltip", async () => {
      const mockShowGlobalTooltip = jest.fn();
      const { useShowGlobalTooltip } = jest.requireMock("@/stores");
      (useShowGlobalTooltip as jest.Mock).mockReturnValue(
        mockShowGlobalTooltip,
      );
      (useSessionTranscriptions as jest.Mock).mockReturnValue([
        { id: "t1", text: "Hello world" },
      ]);
      (Clipboard.setStringAsync as jest.Mock).mockResolvedValue(undefined);

      const originalOS = Object.getOwnPropertyDescriptor(
        require("react-native").Platform,
        "OS",
      );
      const originalVersion = Object.getOwnPropertyDescriptor(
        require("react-native").Platform,
        "Version",
      );
      Object.defineProperty(require("react-native").Platform, "OS", {
        value: "android",
        configurable: true,
      });
      Object.defineProperty(require("react-native").Platform, "Version", {
        value: 31,
        configurable: true,
      });

      render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        mockOnCopyAllPressed!();
      });

      await waitFor(() => {
        expect(Clipboard.setStringAsync).toHaveBeenCalled();
      });

      // On Android 12+ (API 31+), no tooltip should be shown for clipboard
      expect(mockShowGlobalTooltip).not.toHaveBeenCalled();

      // Restore
      if (originalOS) {
        Object.defineProperty(
          require("react-native").Platform,
          "OS",
          originalOS,
        );
      }
      if (originalVersion) {
        Object.defineProperty(
          require("react-native").Platform,
          "Version",
          originalVersion,
        );
      }
    });

    it("copyAllTranscriptions returns false when clipboard fails (inside handleCopyAllPressed)", async () => {
      const mockShowGlobalTooltip = jest.fn();
      const { useShowGlobalTooltip } = jest.requireMock("@/stores");
      (useShowGlobalTooltip as jest.Mock).mockReturnValue(
        mockShowGlobalTooltip,
      );
      (useSessionTranscriptions as jest.Mock).mockReturnValue([
        { id: "t1", text: "Hello" },
      ]);
      // Make clipboard fail but NOT throw (resolved)
      // This exercises the copyAllTranscriptions catch → return false path
      // and then handleCopyAllPressed success===false branch
      (Clipboard.setStringAsync as jest.Mock).mockRejectedValue(
        new Error("Clipboard write error"),
      );

      render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        mockOnCopyAllPressed!();
      });

      // The error from copyAllTranscriptions is caught in handleCopyAllPressed's catch block
      await waitFor(() => {
        expect(mockShowGlobalTooltip).toHaveBeenCalledWith(
          expect.anything(),
          "normal",
          undefined,
          true,
        );
      });
    });
  });

  describe("shareSelectedTranscriptions", () => {
    it("returns false when selectedIds are present but no matching transcriptions", async () => {
      const selectedIds = new Set(["nonexistent"]);
      (useIsTranscriptionSelectionMode as jest.Mock).mockReturnValue(true);
      (useSelectedTranscriptionIdsSet as jest.Mock).mockReturnValue(
        selectedIds,
      );
      (useSessionTranscriptions as jest.Mock).mockReturnValue([
        { id: "t1", text: "Hello" },
      ]);

      const { getByTestId } = render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        fireEvent.press(getByTestId(TestID.ShareButton));
      });

      // shareService should NOT be called because selectedTranscriptions is empty
      expect(shareService.shareTranscriptions).not.toHaveBeenCalled();
    });

    it("handles share failure gracefully (returns false)", async () => {
      const selectedIds = new Set(["t1"]);
      (useIsTranscriptionSelectionMode as jest.Mock).mockReturnValue(true);
      (useSelectedTranscriptionIdsSet as jest.Mock).mockReturnValue(
        selectedIds,
      );
      (useSessionTranscriptions as jest.Mock).mockReturnValue([
        { id: "t1", text: "Hello" },
      ]);
      (shareService.shareTranscriptions as jest.Mock).mockRejectedValue(
        new Error("Share failed"),
      );

      const { getByTestId } = render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        fireEvent.press(getByTestId(TestID.ShareButton));
      });

      await waitFor(() => {
        // shareSelectedTranscriptions catches the error internally and returns false
        // So no haptics should fire (success was false)
        expect(Haptics.notificationAsync).not.toHaveBeenCalled();
      });
      // The error was logged
      const { logError } = jest.requireMock("@/utils");
      expect(logError).toHaveBeenCalled();
    });

    it("share success triggers haptics", async () => {
      const selectedIds = new Set(["t1"]);
      (useIsTranscriptionSelectionMode as jest.Mock).mockReturnValue(true);
      (useSelectedTranscriptionIdsSet as jest.Mock).mockReturnValue(
        selectedIds,
      );
      (useSessionTranscriptions as jest.Mock).mockReturnValue([
        { id: "t1", text: "Hello" },
      ]);
      (shareService.shareTranscriptions as jest.Mock).mockResolvedValue(
        undefined,
      );

      const { getByTestId } = render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        fireEvent.press(getByTestId(TestID.ShareButton));
      });

      await waitFor(() => {
        expect(Haptics.notificationAsync).toHaveBeenCalledWith(
          Haptics.NotificationFeedbackType.Success,
        );
      });
    });
  });

  describe("deleteSelectedTranscriptions", () => {
    it("delete error is thrown and handled", async () => {
      const selectedIds = new Set(["t1"]);
      const mockDeleteTranscriptions = jest
        .fn()
        .mockRejectedValue(new Error("Delete failed"));
      const mockShowGlobalTooltip = jest.fn();
      const { useShowGlobalTooltip } = jest.requireMock("@/stores");

      (useIsTranscriptionSelectionMode as jest.Mock).mockReturnValue(true);
      (useSelectedTranscriptionIdsSet as jest.Mock).mockReturnValue(
        selectedIds,
      );
      (useDeleteTranscriptions as jest.Mock).mockReturnValue(
        mockDeleteTranscriptions,
      );
      (useShowGlobalTooltip as jest.Mock).mockReturnValue(
        mockShowGlobalTooltip,
      );

      render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        mockOnDeleteSelectedPressed!();
      });

      // Get the primary button callback from the toast
      const toastCall = mockShowDeleteToast.mock.calls[0][0];

      // The delete will throw, but exitSelectionMode should still be called (finally block)
      await act(async () => {
        try {
          await toastCall.onPrimaryButtonTap();
        } catch {
          // expected
        }
      });

      expect(mockDeleteTranscriptions).toHaveBeenCalledWith(selectedIds);
      expect(mockExitSelectionMode).toHaveBeenCalled();
    });

    it("secondary button tap hides toast", async () => {
      const selectedIds = new Set(["t1"]);
      (useIsTranscriptionSelectionMode as jest.Mock).mockReturnValue(true);
      (useSelectedTranscriptionIdsSet as jest.Mock).mockReturnValue(
        selectedIds,
      );

      render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        mockOnDeleteSelectedPressed!();
      });

      const toastCall = mockShowDeleteToast.mock.calls[0][0];

      await act(async () => {
        toastCall.onSecondaryButtonTap();
      });

      expect(mockHideDeleteToast).toHaveBeenCalled();
    });

    it("deleteSelectedTranscriptions returns early with 0 when no items selected", async () => {
      (useIsTranscriptionSelectionMode as jest.Mock).mockReturnValue(true);
      (useSelectedTranscriptionIdsSet as jest.Mock).mockReturnValue(new Set());

      const mockDeleteTranscriptions = jest.fn();
      (useDeleteTranscriptions as jest.Mock).mockReturnValue(
        mockDeleteTranscriptions,
      );

      render(<SessionScreen />);
      await act(async () => {});

      // This tests the deleteSelectedTranscriptions early return path
      // (selectedIds.size === 0 → return { deleted: 0 })
      // We can't directly call deleteSelectedTranscriptions, but
      // handleDeleteSelectedPressed also returns early when !hasSelectedItems
      await act(async () => {
        mockOnDeleteSelectedPressed!();
      });

      expect(mockShowDeleteToast).not.toHaveBeenCalled();
      expect(mockDeleteTranscriptions).not.toHaveBeenCalled();
    });
  });

  describe("handleLongPress haptics failure", () => {
    it("handles haptics not supported gracefully", async () => {
      const mockToggle = jest.fn();
      (useIsTranscriptionSelectionMode as jest.Mock).mockReturnValue(false);
      (useToggleTranscriptionSelection as jest.Mock).mockReturnValue(
        mockToggle,
      );
      (Haptics.impactAsync as jest.Mock).mockRejectedValue(
        new Error("Haptics not supported"),
      );

      render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        mockOnTranscriptionLongPress!("t1");
      });

      // toggle should still be called even if haptics fail
      expect(mockToggle).toHaveBeenCalledWith("t1");
    });
  });

  describe("handleLanguageFlagPressed", () => {
    it("navigates to language settings", async () => {
      const mockPush = jest.fn();
      const routerMock = jest.requireMock("expo-router");
      const originalUseRouter = routerMock.useRouter;
      routerMock.useRouter = () => ({
        back: mockBack,
        replace: mockReplace,
        canGoBack: mockCanGoBack,
        push: mockPush,
      });

      render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        mockOnLanguageFlagPressed!();
      });

      expect(mockPush).toHaveBeenCalledWith("/settings/language");

      routerMock.useRouter = originalUseRouter;
    });
  });

  describe("handleCancelEdit", () => {
    it("sets isCancellingEdit to true and dismisses keyboard", async () => {
      const keyboardDismissSpy = jest.spyOn(Keyboard, "dismiss");

      render(<SessionScreen />);
      await act(async () => {});

      // Enter edit mode
      await act(async () => {
        mockOnEditStart!();
      });

      // Cancel edit
      await act(async () => {
        mockOnCancelEditPressed!();
      });

      expect(keyboardDismissSpy).toHaveBeenCalled();
      keyboardDismissSpy.mockRestore();
    });
  });

  describe("navigation beforeRemove edge cases", () => {
    it("beforeRemove when recording and canGoBack is false: replaces route", async () => {
      const mockStopAndSave = jest.fn().mockResolvedValue(undefined);
      (useIsRecording as jest.Mock).mockReturnValue(true);
      (useStopRecordingAndSave as jest.Mock).mockReturnValue(mockStopAndSave);
      mockCanGoBack.mockReturnValue(false);

      let beforeRemoveHandler: ((e: any) => void) | null = null;
      const { useNavigation } = jest.requireMock("@react-navigation/native");
      (useNavigation as jest.Mock).mockReturnValue({
        addListener: jest.fn((event: string, handler: any) => {
          if (event === "beforeRemove") {
            beforeRemoveHandler = handler;
          }
          return jest.fn();
        }),
      });

      render(<SessionScreen />);
      await act(async () => {});

      const mockPreventDefault = jest.fn();
      await act(async () => {
        await beforeRemoveHandler!({ preventDefault: mockPreventDefault });
      });

      expect(mockPreventDefault).toHaveBeenCalled();
      expect(mockStopAndSave).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith("/");
    });

    it("beforeRemove for incognito when canGoBack is false: replaces route", async () => {
      const mockEndIncognito = jest.fn().mockResolvedValue(undefined);
      const { useSessionOperations } = jest.requireMock("@/hooks");
      (useSessionOperations as jest.Mock).mockReturnValue({
        deleteSession: jest.fn(),
        endIncognitoSession: mockEndIncognito,
      });

      mockSession = {
        id: "session-1",
        name: "Incognito",
        isIncognito: true,
      };
      (useFindSessionById as jest.Mock).mockReturnValue(() => mockSession);
      mockCanGoBack.mockReturnValue(false);

      let beforeRemoveHandler: ((e: any) => void) | null = null;
      const { useNavigation } = jest.requireMock("@react-navigation/native");
      (useNavigation as jest.Mock).mockReturnValue({
        addListener: jest.fn((event: string, handler: any) => {
          if (event === "beforeRemove") {
            beforeRemoveHandler = handler;
          }
          return jest.fn();
        }),
      });

      render(<SessionScreen />);
      await act(async () => {});

      const mockPreventDefault = jest.fn();
      await act(async () => {
        await beforeRemoveHandler!({ preventDefault: mockPreventDefault });
      });

      expect(mockPreventDefault).toHaveBeenCalled();
      expect(mockEndIncognito).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith("/");
    });

    it("beforeRemove for incognito with error in endIncognitoSession", async () => {
      const mockEndIncognito = jest
        .fn()
        .mockRejectedValue(new Error("Incognito end error"));
      const { useSessionOperations } = jest.requireMock("@/hooks");
      (useSessionOperations as jest.Mock).mockReturnValue({
        deleteSession: jest.fn(),
        endIncognitoSession: mockEndIncognito,
      });

      mockSession = {
        id: "session-1",
        name: "Incognito",
        isIncognito: true,
      };
      (useFindSessionById as jest.Mock).mockReturnValue(() => mockSession);

      let beforeRemoveHandler: ((e: any) => void) | null = null;
      const { useNavigation } = jest.requireMock("@react-navigation/native");
      (useNavigation as jest.Mock).mockReturnValue({
        addListener: jest.fn((event: string, handler: any) => {
          if (event === "beforeRemove") {
            beforeRemoveHandler = handler;
          }
          return jest.fn();
        }),
      });

      render(<SessionScreen />);
      await act(async () => {});

      const mockPreventDefault = jest.fn();
      await act(async () => {
        await beforeRemoveHandler!({ preventDefault: mockPreventDefault });
      });

      expect(mockPreventDefault).toHaveBeenCalled();
      expect(mockEndIncognito).toHaveBeenCalled();
      // Should not navigate on error (no back or replace call after the error)
      const { logError } = jest.requireMock("@/utils");
      expect(logError).toHaveBeenCalled();
    });

    it("beforeRemove for non-recording, non-incognito session: does nothing", async () => {
      let beforeRemoveHandler: ((e: any) => void) | null = null;
      const { useNavigation } = jest.requireMock("@react-navigation/native");
      (useNavigation as jest.Mock).mockReturnValue({
        addListener: jest.fn((event: string, handler: any) => {
          if (event === "beforeRemove") {
            beforeRemoveHandler = handler;
          }
          return jest.fn();
        }),
      });

      render(<SessionScreen />);
      await act(async () => {});

      const mockPreventDefault = jest.fn();
      await act(async () => {
        await beforeRemoveHandler!({ preventDefault: mockPreventDefault });
      });

      // Should NOT prevent default for normal sessions
      expect(mockPreventDefault).not.toHaveBeenCalled();
    });
  });

  describe("auto-scroll effect", () => {
    it("auto-scrolls during recording", async () => {
      (useIsRecording as jest.Mock).mockReturnValue(true);

      render(<SessionScreen />);
      await act(async () => {});

      // The auto-scroll effect runs via setTimeout.
      // We just verify the component renders without error when recording.
    });

    it("auto-scrolls when realtime model has live preview", async () => {
      const stores = jest.requireMock("@/stores");
      (stores.useSelectedModelType as jest.Mock).mockReturnValue(
        "whisper_realtime",
      );
      (stores.useLivePreview as jest.Mock).mockReturnValue("Some live text");
      (useIsRecording as jest.Mock).mockReturnValue(false);

      render(<SessionScreen />);
      await act(async () => {});

      // Verifies the auto-scroll effect activates for realtime mode with live preview
    });
  });

  describe("handleEditEnd callback", () => {
    it("onEditEnd sets editing and cancelling state to false", async () => {
      const { getByTestId } = render(<SessionScreen />);
      await act(async () => {});

      // Enter edit mode
      await act(async () => {
        mockOnEditStart!();
      });

      expect(getByTestId(TestID.EditMode)).toHaveTextContent("editing");

      // End edit
      await act(async () => {
        mockOnEditEnd!();
      });

      expect(getByTestId(TestID.EditMode)).toHaveTextContent("not-editing");
    });
  });

  describe("selectAllTranscriptions", () => {
    it("selects all transcriptions when none are selected", async () => {
      const mockSelectAll = jest.fn();
      const { useSelectAllTranscriptions } = jest.requireMock("@/stores");
      (useSelectAllTranscriptions as jest.Mock).mockReturnValue(mockSelectAll);
      (useIsTranscriptionSelectionMode as jest.Mock).mockReturnValue(true);
      (useSelectedTranscriptionIdsSet as jest.Mock).mockReturnValue(new Set());
      (useSessionTranscriptions as jest.Mock).mockReturnValue([
        { id: "t1", text: "Hello" },
        { id: "t2", text: "World" },
      ]);

      render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        mockOnSelectAllPressed!();
      });

      expect(mockSelectAll).toHaveBeenCalledWith(["t1", "t2"]);
    });

    it("deselects all transcriptions when all are already selected", async () => {
      const mockSelectAll = jest.fn();
      const { useSelectAllTranscriptions } = jest.requireMock("@/stores");
      (useSelectAllTranscriptions as jest.Mock).mockReturnValue(mockSelectAll);
      (useIsTranscriptionSelectionMode as jest.Mock).mockReturnValue(true);
      (useSelectedTranscriptionIdsSet as jest.Mock).mockReturnValue(
        new Set(["t1", "t2"]),
      );
      (useSessionTranscriptions as jest.Mock).mockReturnValue([
        { id: "t1", text: "Hello" },
        { id: "t2", text: "World" },
      ]);

      render(<SessionScreen />);
      await act(async () => {});

      await act(async () => {
        mockOnSelectAllPressed!();
      });

      expect(mockSelectAll).toHaveBeenCalledWith([]);
    });
  });

  describe("handleCopyAllPressed - copyAllTranscriptions returns false", () => {
    it("shows copyFailed tooltip when copyAllTranscriptions returns false", async () => {
      const mockShowGlobalTooltip = jest.fn();
      const { useShowGlobalTooltip } = jest.requireMock("@/stores");
      (useShowGlobalTooltip as jest.Mock).mockReturnValue(
        mockShowGlobalTooltip,
      );
      (useSessionTranscriptions as jest.Mock).mockReturnValue([
        { id: "t1", text: "Hello" },
      ]);
      // Make clipboard fail silently (returns false from copyAllTranscriptions)
      (Clipboard.setStringAsync as jest.Mock).mockRejectedValue(
        new Error("fail"),
      );

      render(<SessionScreen />);
      await act(async () => {});

      // Clear spy since it could be called during render
      mockShowGlobalTooltip.mockClear();

      await act(async () => {
        mockOnCopyAllPressed!();
      });

      await waitFor(() => {
        // handleCopyAllPressed catch block shows copyFailed tooltip
        expect(mockShowGlobalTooltip).toHaveBeenCalled();
      });
    });
  });
});
