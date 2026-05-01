import * as Crypto from "expo-crypto";
import { act, renderHook } from "@testing-library/react-native";

import {
  useUIStore,
  useIsTranscriptionSelectionMode,
  useSelectedTranscriptionIdsSet,
  useIsSessionSelectionMode,
  useSelectedSessionIdsSet,
  useSelectedSessionIds,
  useToggleSessionSelection,
  useExitSessionSelection,
  useToggleTranscriptionSelection,
  useSelectAllTranscriptions,
  useExitTranscriptionSelection,
  useShowToast,
  useGlobalTooltip,
  useShowGlobalTooltip,
  useHideGlobalTooltip,
  useKeyboardPromptVisible,
  useShowKeyboardPrompt,
  useHideKeyboardPrompt,
  useRecordingControlsEnabled,
  useRecordingControlsVisible,
  useOnRecordingStart,
  useOnRecordingStop,
  useSetRecordingControlsEnabled,
  useSetRecordingControlsVisible,
  useSetRecordingCallbacks,
} from "./uiStore";

const initialState = {
  isTranscriptionSelectionMode: false,
  selectedTranscriptionIds: new Set<string>(),
  isSessionSelectionMode: false,
  selectedSessionIds: new Set<string>(),
  toasts: [],
  globalTooltip: null,
  recordingControlsEnabled: true,
  recordingControlsVisible: true,
  onRecordingStart: null,
  onRecordingStop: null,
};

describe("uiStore", () => {
  beforeEach(() => {
    useUIStore.setState(initialState);
    let callCount = 0;
    (Crypto.randomUUID as jest.Mock).mockImplementation(
      () => `mock-uuid-${++callCount}`,
    );
  });

  describe("initial state", () => {
    it("has correct defaults", () => {
      const state = useUIStore.getState();
      expect(state.isTranscriptionSelectionMode).toBe(false);
      expect(state.selectedTranscriptionIds.size).toBe(0);
      expect(state.isSessionSelectionMode).toBe(false);
      expect(state.selectedSessionIds.size).toBe(0);
      expect(state.toasts).toEqual([]);
      expect(state.globalTooltip).toBeNull();
      expect(state.recordingControlsEnabled).toBe(true);
      expect(state.recordingControlsVisible).toBe(true);
      expect(state.onRecordingStart).toBeNull();
      expect(state.onRecordingStop).toBeNull();
    });
  });

  describe("transcription selection", () => {
    it("toggle adds an ID and enables selection mode", () => {
      useUIStore.getState().toggleTranscriptionSelection("t1");
      const state = useUIStore.getState();
      expect(state.selectedTranscriptionIds.has("t1")).toBe(true);
      expect(state.isTranscriptionSelectionMode).toBe(true);
    });

    it("toggle removes an existing ID", () => {
      useUIStore.getState().toggleTranscriptionSelection("t1");
      useUIStore.getState().toggleTranscriptionSelection("t1");
      const state = useUIStore.getState();
      expect(state.selectedTranscriptionIds.has("t1")).toBe(false);
      expect(state.isTranscriptionSelectionMode).toBe(false);
    });

    it("removing last ID disables selection mode", () => {
      useUIStore.getState().toggleTranscriptionSelection("t1");
      useUIStore.getState().toggleTranscriptionSelection("t2");
      useUIStore.getState().toggleTranscriptionSelection("t1");
      useUIStore.getState().toggleTranscriptionSelection("t2");

      expect(useUIStore.getState().isTranscriptionSelectionMode).toBe(false);
    });

    it("selectAll sets all IDs and enables mode", () => {
      useUIStore.getState().selectAllTranscriptions(["t1", "t2", "t3"]);
      const state = useUIStore.getState();
      expect(state.selectedTranscriptionIds.size).toBe(3);
      expect(state.isTranscriptionSelectionMode).toBe(true);
    });

    it("selectAll with empty array disables mode", () => {
      useUIStore.getState().selectAllTranscriptions(["t1"]);
      useUIStore.getState().selectAllTranscriptions([]);
      const state = useUIStore.getState();
      expect(state.selectedTranscriptionIds.size).toBe(0);
      expect(state.isTranscriptionSelectionMode).toBe(false);
    });

    it("exitTranscriptionSelection clears everything", () => {
      useUIStore.getState().toggleTranscriptionSelection("t1");
      useUIStore.getState().exitTranscriptionSelection();
      const state = useUIStore.getState();
      expect(state.selectedTranscriptionIds.size).toBe(0);
      expect(state.isTranscriptionSelectionMode).toBe(false);
    });
  });

  describe("session selection", () => {
    it("toggle adds an ID and enables selection mode", () => {
      useUIStore.getState().toggleSessionSelection("s1");
      const state = useUIStore.getState();
      expect(state.selectedSessionIds.has("s1")).toBe(true);
      expect(state.isSessionSelectionMode).toBe(true);
    });

    it("toggle removes an existing ID and disables mode when empty", () => {
      useUIStore.getState().toggleSessionSelection("s1");
      useUIStore.getState().toggleSessionSelection("s1");
      const state = useUIStore.getState();
      expect(state.selectedSessionIds.has("s1")).toBe(false);
      expect(state.isSessionSelectionMode).toBe(false);
    });

    it("exitSessionSelection clears everything", () => {
      useUIStore.getState().toggleSessionSelection("s1");
      useUIStore.getState().exitSessionSelection();
      const state = useUIStore.getState();
      expect(state.selectedSessionIds.size).toBe(0);
      expect(state.isSessionSelectionMode).toBe(false);
    });
  });

  describe("toasts", () => {
    it("showToast creates a toast with ID and default variant", () => {
      const id = useUIStore.getState().showToast("Hello");
      expect(id).toBe("mock-uuid-1");
      const toast = useUIStore.getState().toasts[0];
      expect(toast).toEqual({
        id: "mock-uuid-1",
        message: "Hello",
        variant: "info",
        duration: undefined,
      });
    });

    it("showToast accepts custom variant and duration", () => {
      useUIStore.getState().showToast("Error!", "error", 5000);
      const toast = useUIStore.getState().toasts[0];
      expect(toast.variant).toBe("error");
      expect(toast.duration).toBe(5000);
    });

    it("showToast appends multiple toasts", () => {
      useUIStore.getState().showToast("First");
      useUIStore.getState().showToast("Second");
      expect(useUIStore.getState().toasts).toHaveLength(2);
    });

    it("hideToast removes by ID", () => {
      const id = useUIStore.getState().showToast("To remove");
      useUIStore.getState().showToast("Keep");
      useUIStore.getState().hideToast(id);

      const toasts = useUIStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toBe("Keep");
    });
  });

  describe("globalTooltip", () => {
    it("show sets singleton with defaults", () => {
      const id = useUIStore.getState().showGlobalTooltip("Tip");
      const tooltip = useUIStore.getState().globalTooltip;
      expect(id).toBe("mock-uuid-1");
      expect(tooltip).toEqual({
        id: "mock-uuid-1",
        message: "Tip",
        variant: "normal",
        duration: 3000,
        isInfo: false,
        isDismissible: false,
        action: undefined,
      });
    });

    it("show with custom params", () => {
      const action = { iconName: "close", onPress: jest.fn() };
      useUIStore
        .getState()
        .showGlobalTooltip("Warning", "warning", 5000, true, true, action);

      const tooltip = useUIStore.getState().globalTooltip!;
      expect(tooltip.variant).toBe("warning");
      expect(tooltip.duration).toBe(5000);
      expect(tooltip.isInfo).toBe(true);
      expect(tooltip.isDismissible).toBe(true);
      expect(tooltip.action).toBe(action);
    });

    it("show replaces previous tooltip", () => {
      useUIStore.getState().showGlobalTooltip("First");
      useUIStore.getState().showGlobalTooltip("Second");
      expect(useUIStore.getState().globalTooltip!.message).toBe("Second");
    });

    it("hide clears to null", () => {
      useUIStore.getState().showGlobalTooltip("Tip");
      useUIStore.getState().hideGlobalTooltip();
      expect(useUIStore.getState().globalTooltip).toBeNull();
    });
  });

  describe("recording controls", () => {
    it("setEnabled updates recordingControlsEnabled", () => {
      useUIStore.getState().setRecordingControlsEnabled(false);
      expect(useUIStore.getState().recordingControlsEnabled).toBe(false);
    });

    it("setVisible updates recordingControlsVisible", () => {
      useUIStore.getState().setRecordingControlsVisible(false);
      expect(useUIStore.getState().recordingControlsVisible).toBe(false);
    });

    it("setRecordingCallbacks sets callbacks", () => {
      const onStart = jest.fn();
      const onStop = jest.fn();
      useUIStore.getState().setRecordingCallbacks(onStart, onStop);

      const state = useUIStore.getState();
      expect(state.onRecordingStart).toBe(onStart);
      expect(state.onRecordingStop).toBe(onStop);
    });

    it("setRecordingCallbacks can clear callbacks with null", () => {
      useUIStore.getState().setRecordingCallbacks(jest.fn(), jest.fn());
      useUIStore.getState().setRecordingCallbacks(null, null);

      const state = useUIStore.getState();
      expect(state.onRecordingStart).toBeNull();
      expect(state.onRecordingStop).toBeNull();
    });
  });

  describe("selector hooks", () => {
    it("useIsTranscriptionSelectionMode returns false by default", () => {
      const { result } = renderHook(() => useIsTranscriptionSelectionMode());
      expect(result.current).toBe(false);
    });

    it("useSelectedTranscriptionIdsSet returns empty Set by default", () => {
      const { result } = renderHook(() => useSelectedTranscriptionIdsSet());
      expect(result.current).toBeInstanceOf(Set);
      expect(result.current.size).toBe(0);
    });

    it("useIsSessionSelectionMode returns false by default", () => {
      const { result } = renderHook(() => useIsSessionSelectionMode());
      expect(result.current).toBe(false);
    });

    it("useSelectedSessionIdsSet returns empty Set by default", () => {
      const { result } = renderHook(() => useSelectedSessionIdsSet());
      expect(result.current).toBeInstanceOf(Set);
      expect(result.current.size).toBe(0);
    });

    it("useSelectedSessionIds returns empty array by default", () => {
      const { result } = renderHook(() => useSelectedSessionIds());
      expect(result.current).toEqual([]);
    });

    it("useToggleSessionSelection returns a function", () => {
      const { result } = renderHook(() => useToggleSessionSelection());
      expect(typeof result.current).toBe("function");
    });

    it("useExitSessionSelection returns a function", () => {
      const { result } = renderHook(() => useExitSessionSelection());
      expect(typeof result.current).toBe("function");
    });

    it("useToggleTranscriptionSelection returns a function", () => {
      const { result } = renderHook(() => useToggleTranscriptionSelection());
      expect(typeof result.current).toBe("function");
    });

    it("useSelectAllTranscriptions returns a function", () => {
      const { result } = renderHook(() => useSelectAllTranscriptions());
      expect(typeof result.current).toBe("function");
    });

    it("useExitTranscriptionSelection returns a function", () => {
      const { result } = renderHook(() => useExitTranscriptionSelection());
      expect(typeof result.current).toBe("function");
    });

    it("useShowToast returns a function", () => {
      const { result } = renderHook(() => useShowToast());
      expect(typeof result.current).toBe("function");
    });

    it("useGlobalTooltip returns null by default", () => {
      const { result } = renderHook(() => useGlobalTooltip());
      expect(result.current).toBeNull();
    });

    it("useShowGlobalTooltip returns a function", () => {
      const { result } = renderHook(() => useShowGlobalTooltip());
      expect(typeof result.current).toBe("function");
    });

    it("useHideGlobalTooltip returns a function", () => {
      const { result } = renderHook(() => useHideGlobalTooltip());
      expect(typeof result.current).toBe("function");
    });

    it("useRecordingControlsEnabled returns true by default", () => {
      const { result } = renderHook(() => useRecordingControlsEnabled());
      expect(result.current).toBe(true);
    });

    it("useRecordingControlsVisible returns true by default", () => {
      const { result } = renderHook(() => useRecordingControlsVisible());
      expect(result.current).toBe(true);
    });

    it("useOnRecordingStart returns null by default", () => {
      const { result } = renderHook(() => useOnRecordingStart());
      expect(result.current).toBeNull();
    });

    it("useOnRecordingStop returns null by default", () => {
      const { result } = renderHook(() => useOnRecordingStop());
      expect(result.current).toBeNull();
    });

    it("useSetRecordingControlsEnabled returns a function", () => {
      const { result } = renderHook(() => useSetRecordingControlsEnabled());
      expect(typeof result.current).toBe("function");
    });

    it("useSetRecordingControlsVisible returns a function", () => {
      const { result } = renderHook(() => useSetRecordingControlsVisible());
      expect(typeof result.current).toBe("function");
    });

    it("useSetRecordingCallbacks returns a function", () => {
      const { result } = renderHook(() => useSetRecordingCallbacks());
      expect(typeof result.current).toBe("function");
    });
  });

  describe("Keyboard prompt visibility", () => {
    it("defaults to hidden", () => {
      const { result } = renderHook(() => useKeyboardPromptVisible());
      expect(result.current).toBe(false);
    });

    it("showKeyboardPrompt flips visibility to true", () => {
      const { result } = renderHook(() => useShowKeyboardPrompt());
      act(() => {
        result.current();
      });
      expect(useUIStore.getState().keyboardPromptVisible).toBe(true);
    });

    it("hideKeyboardPrompt flips visibility back to false", () => {
      useUIStore.setState({ keyboardPromptVisible: true });
      const { result } = renderHook(() => useHideKeyboardPrompt());
      act(() => {
        result.current();
      });
      expect(useUIStore.getState().keyboardPromptVisible).toBe(false);
    });
  });
});
