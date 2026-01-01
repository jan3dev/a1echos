import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';
export type GlobalTooltipVariant = 'normal' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

export interface GlobalTooltip {
  id: string;
  message: string;
  variant: GlobalTooltipVariant;
  duration: number;
  isInfo?: boolean;
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

  setRecordingControlsEnabled: (enabled: boolean) => void;
  setRecordingControlsVisible: (visible: boolean) => void;
  setRecordingCallbacks: (
    onStart: (() => void) | null,
    onStop: (() => void) | null
  ) => void;

  toggleTranscriptionSelection: (id: string) => void;
  selectAllTranscriptions: (ids: string[]) => void;
  exitTranscriptionSelection: () => void;

  toggleSessionSelection: (id: string) => void;
  exitSessionSelection: () => void;

  showToast: (
    message: string,
    variant?: ToastVariant,
    duration?: number
  ) => string;
  hideToast: (toastId: string) => void;

  showGlobalTooltip: (
    message: string,
    variant?: GlobalTooltipVariant,
    duration?: number,
    isInfo?: boolean
  ) => string;
  hideGlobalTooltip: () => void;
}

const toggleIdInSet = (
  currentSet: Set<string>,
  id: string
): { newSet: Set<string>; isSelectionMode: boolean } => {
  const newSet = new Set(currentSet);

  if (newSet.has(id)) {
    newSet.delete(id);
  } else {
    newSet.add(id);
  }

  return {
    newSet,
    isSelectionMode: newSet.size > 0,
  };
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

  setRecordingControlsEnabled: (enabled: boolean) => {
    set({ recordingControlsEnabled: enabled });
  },

  setRecordingControlsVisible: (visible: boolean) => {
    set({ recordingControlsVisible: visible });
  },

  setRecordingCallbacks: (
    onStart: (() => void) | null,
    onStop: (() => void) | null
  ) => {
    set({ onRecordingStart: onStart, onRecordingStop: onStop });
  },

  toggleTranscriptionSelection: (id: string) => {
    const state = get();
    const { newSet, isSelectionMode } = toggleIdInSet(
      state.selectedTranscriptionIds,
      id
    );

    set({
      selectedTranscriptionIds: newSet,
      isTranscriptionSelectionMode: isSelectionMode,
    });
  },

  selectAllTranscriptions: (ids: string[]) => {
    set({
      selectedTranscriptionIds: new Set(ids),
      isTranscriptionSelectionMode: ids.length > 0,
    });
  },

  exitTranscriptionSelection: () => {
    set({
      isTranscriptionSelectionMode: false,
      selectedTranscriptionIds: new Set(),
    });
  },

  toggleSessionSelection: (id: string) => {
    const state = get();
    const { newSet, isSelectionMode } = toggleIdInSet(
      state.selectedSessionIds,
      id
    );

    set({
      selectedSessionIds: newSet,
      isSessionSelectionMode: isSelectionMode,
    });
  },

  exitSessionSelection: () => {
    set({
      isSessionSelectionMode: false,
      selectedSessionIds: new Set(),
    });
  },

  showToast: (
    message: string,
    variant: ToastVariant = 'info',
    duration?: number
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
    variant: GlobalTooltipVariant = 'normal',
    duration: number = DEFAULT_GLOBAL_TOOLTIP_DURATION,
    isInfo: boolean = false
  ) => {
    const tooltipId = Crypto.randomUUID();
    set({
      globalTooltip: {
        id: tooltipId,
        message,
        variant,
        duration,
        isInfo,
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
export const useExitSessionSelection = () =>
  useUIStore((s) => s.exitSessionSelection);

export const useToggleTranscriptionSelection = () =>
  useUIStore((s) => s.toggleTranscriptionSelection);
export const useSelectAllTranscriptions = () =>
  useUIStore((s) => s.selectAllTranscriptions);
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

export default useUIStore;
