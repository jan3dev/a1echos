import * as Crypto from "expo-crypto";
import { create } from "zustand";
import { useShallow } from "zustand/shallow";

export type ToastVariant = "info" | "success" | "warning" | "error";
export type GlobalTooltipVariant = "normal" | "error";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

export interface GlobalTooltipAction {
  iconName: string;
  onPress: () => void;
}

export interface GlobalTooltip {
  id: string;
  message: string;
  variant: GlobalTooltipVariant;
  duration: number;
  isInfo?: boolean;
  isDismissible?: boolean;
  action?: GlobalTooltipAction;
}

interface UIStore {
  isTranscriptionSelectionMode: boolean;
  selectedTranscriptionIds: Set<string>;
  isSessionSelectionMode: boolean;
  selectedSessionIds: Set<string>;
  toasts: Toast[];
  globalTooltip: GlobalTooltip | null;

  recordingControlsEnabled: boolean;
  recordingControlsVisible: boolean;
  onRecordingStart: (() => void) | null;
  onRecordingStop: (() => void) | null;

  keyboardPromptVisible: boolean;
  showKeyboardPrompt: () => void;
  hideKeyboardPrompt: () => void;

  voiceSessionHintVisible: boolean;
  showVoiceSessionHint: () => void;
  hideVoiceSessionHint: () => void;

  setRecordingControlsEnabled: (enabled: boolean) => void;
  setRecordingControlsVisible: (visible: boolean) => void;
  setRecordingCallbacks: (
    onStart: (() => void) | null,
    onStop: (() => void) | null,
  ) => void;

  toggleTranscriptionSelection: (id: string) => void;
  selectAllTranscriptions: (ids: string[]) => void;
  enterTranscriptionSelection: () => void;
  exitTranscriptionSelection: () => void;

  toggleSessionSelection: (id: string) => void;
  enterSessionSelection: () => void;
  exitSessionSelection: () => void;

  showToast: (
    message: string,
    variant?: ToastVariant,
    duration?: number,
  ) => string;
  hideToast: (toastId: string) => void;

  showGlobalTooltip: (
    message: string,
    variant?: GlobalTooltipVariant,
    duration?: number,
    isInfo?: boolean,
    isDismissible?: boolean,
    action?: GlobalTooltipAction,
  ) => string;
  hideGlobalTooltip: () => void;
}

const toggleIdInSet = (
  currentSet: Set<string>,
  id: string,
): { newSet: Set<string> } => {
  const newSet = new Set(currentSet);

  if (newSet.has(id)) {
    newSet.delete(id);
  } else {
    newSet.add(id);
  }

  return { newSet };
};

const DEFAULT_GLOBAL_TOOLTIP_DURATION = 3000;

export const useUIStore = create<UIStore>((set, get) => ({
  isTranscriptionSelectionMode: false,
  selectedTranscriptionIds: new Set(),
  isSessionSelectionMode: false,
  selectedSessionIds: new Set(),
  toasts: [],
  globalTooltip: null,

  recordingControlsEnabled: true,
  recordingControlsVisible: true,
  onRecordingStart: null,
  onRecordingStop: null,

  keyboardPromptVisible: false,

  showKeyboardPrompt: () => {
    set({ keyboardPromptVisible: true });
  },

  hideKeyboardPrompt: () => {
    set({ keyboardPromptVisible: false });
  },

  voiceSessionHintVisible: false,

  showVoiceSessionHint: () => {
    set({ voiceSessionHintVisible: true });
  },

  hideVoiceSessionHint: () => {
    set({ voiceSessionHintVisible: false });
  },

  setRecordingControlsEnabled: (enabled: boolean) => {
    set({ recordingControlsEnabled: enabled });
  },

  setRecordingControlsVisible: (visible: boolean) => {
    set({ recordingControlsVisible: visible });
  },

  setRecordingCallbacks: (
    onStart: (() => void) | null,
    onStop: (() => void) | null,
  ) => {
    set({ onRecordingStart: onStart, onRecordingStop: onStop });
  },

  toggleTranscriptionSelection: (id: string) => {
    const state = get();
    const { newSet } = toggleIdInSet(state.selectedTranscriptionIds, id);
    set({
      selectedTranscriptionIds: newSet,
      isTranscriptionSelectionMode:
        state.isTranscriptionSelectionMode || newSet.size > 0,
    });
  },

  selectAllTranscriptions: (ids: string[]) => {
    const state = get();
    set({
      selectedTranscriptionIds: new Set(ids),
      isTranscriptionSelectionMode:
        state.isTranscriptionSelectionMode || ids.length > 0,
    });
  },

  enterTranscriptionSelection: () => {
    set({ isTranscriptionSelectionMode: true });
  },

  exitTranscriptionSelection: () => {
    set({
      isTranscriptionSelectionMode: false,
      selectedTranscriptionIds: new Set(),
    });
  },

  toggleSessionSelection: (id: string) => {
    const state = get();
    const { newSet } = toggleIdInSet(state.selectedSessionIds, id);
    set({
      selectedSessionIds: newSet,
      isSessionSelectionMode: state.isSessionSelectionMode || newSet.size > 0,
    });
  },

  enterSessionSelection: () => {
    set({ isSessionSelectionMode: true });
  },

  exitSessionSelection: () => {
    set({
      isSessionSelectionMode: false,
      selectedSessionIds: new Set(),
    });
  },

  showToast: (
    message: string,
    variant: ToastVariant = "info",
    duration?: number,
  ) => {
    const toastId = Crypto.randomUUID();
    const toast: Toast = {
      id: toastId,
      message,
      variant,
      duration,
    };

    const state = get();
    set({ toasts: [...state.toasts, toast] });

    return toastId;
  },

  hideToast: (toastId: string) => {
    const state = get();
    set({ toasts: state.toasts.filter((t) => t.id !== toastId) });
  },

  showGlobalTooltip: (
    message: string,
    variant: GlobalTooltipVariant = "normal",
    duration: number = DEFAULT_GLOBAL_TOOLTIP_DURATION,
    isInfo: boolean = false,
    isDismissible: boolean = false,
    action?: GlobalTooltipAction,
  ) => {
    const tooltipId = Crypto.randomUUID();
    set({
      globalTooltip: {
        id: tooltipId,
        message,
        variant,
        duration,
        isInfo,
        isDismissible,
        action,
      },
    });
    return tooltipId;
  },

  hideGlobalTooltip: () => {
    set({ globalTooltip: null });
  },
}));

export const useIsTranscriptionSelectionMode = () =>
  useUIStore((s) => s.isTranscriptionSelectionMode);
export const useSelectedTranscriptionIdsSet = () =>
  useUIStore((s) => s.selectedTranscriptionIds);

export const useIsSessionSelectionMode = () =>
  useUIStore((s) => s.isSessionSelectionMode);
// Returns Set directly for O(1) membership checks
export const useSelectedSessionIdsSet = () =>
  useUIStore((s) => s.selectedSessionIds);
export const useSelectedSessionIds = () =>
  useUIStore(useShallow((s) => Array.from(s.selectedSessionIds)));

export const useToggleSessionSelection = () =>
  useUIStore((s) => s.toggleSessionSelection);
export const useEnterSessionSelection = () =>
  useUIStore((s) => s.enterSessionSelection);
export const useExitSessionSelection = () =>
  useUIStore((s) => s.exitSessionSelection);

export const useToggleTranscriptionSelection = () =>
  useUIStore((s) => s.toggleTranscriptionSelection);
export const useSelectAllTranscriptions = () =>
  useUIStore((s) => s.selectAllTranscriptions);
export const useEnterTranscriptionSelection = () =>
  useUIStore((s) => s.enterTranscriptionSelection);
export const useExitTranscriptionSelection = () =>
  useUIStore((s) => s.exitTranscriptionSelection);

export const useShowToast = () => useUIStore((s) => s.showToast);

export const useGlobalTooltip = () => useUIStore((s) => s.globalTooltip);
export const useShowGlobalTooltip = () =>
  useUIStore((s) => s.showGlobalTooltip);
export const useHideGlobalTooltip = () =>
  useUIStore((s) => s.hideGlobalTooltip);

export const useRecordingControlsEnabled = () =>
  useUIStore((s) => s.recordingControlsEnabled);
export const useRecordingControlsVisible = () =>
  useUIStore((s) => s.recordingControlsVisible);
export const useOnRecordingStart = () => useUIStore((s) => s.onRecordingStart);
export const useOnRecordingStop = () => useUIStore((s) => s.onRecordingStop);
export const useSetRecordingControlsEnabled = () =>
  useUIStore((s) => s.setRecordingControlsEnabled);
export const useSetRecordingControlsVisible = () =>
  useUIStore((s) => s.setRecordingControlsVisible);
export const useSetRecordingCallbacks = () =>
  useUIStore((s) => s.setRecordingCallbacks);

export const useKeyboardPromptVisible = () =>
  useUIStore((s) => s.keyboardPromptVisible);
export const useShowKeyboardPrompt = () =>
  useUIStore((s) => s.showKeyboardPrompt);
export const useHideKeyboardPrompt = () =>
  useUIStore((s) => s.hideKeyboardPrompt);

export const useVoiceSessionHintVisible = () =>
  useUIStore((s) => s.voiceSessionHintVisible);
export const useShowVoiceSessionHint = () =>
  useUIStore((s) => s.showVoiceSessionHint);
export const useHideVoiceSessionHint = () =>
  useUIStore((s) => s.hideVoiceSessionHint);

export default useUIStore;
