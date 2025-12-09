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
}

interface UIStore {
  isTranscriptionSelectionMode: boolean;
  selectedTranscriptionIds: Set<string>;
  isSessionSelectionMode: boolean;
  selectedSessionIds: Set<string>;
  visibleModals: Set<string>;
  toasts: Toast[];
  loadingStates: Map<string, boolean>;
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
  isTranscriptionSelected: (id: string) => boolean;
  getSelectedTranscriptionCount: () => number;
  hasSelectedTranscriptions: () => boolean;

  toggleSessionSelection: (id: string) => void;
  exitSessionSelection: () => void;
  isSessionSelected: (id: string) => boolean;
  getSelectedSessionCount: () => number;
  hasSelectedSessions: () => boolean;

  showModal: (modalId: string) => void;
  hideModal: (modalId: string) => void;
  isModalVisible: (modalId: string) => boolean;

  showToast: (
    message: string,
    variant?: ToastVariant,
    duration?: number
  ) => string;
  hideToast: (toastId: string) => void;
  clearAllToasts: () => void;

  setLoading: (operation: string, isLoading: boolean) => void;
  clearLoading: (operation: string) => void;
  isLoading: (operation: string) => boolean;
  hasAnyLoading: () => boolean;

  showGlobalTooltip: (
    message: string,
    variant?: GlobalTooltipVariant,
    duration?: number
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
  visibleModals: new Set(),
  toasts: [],
  loadingStates: new Map(),
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

  isTranscriptionSelected: (id: string) => {
    return get().selectedTranscriptionIds.has(id);
  },

  getSelectedTranscriptionCount: () => {
    return get().selectedTranscriptionIds.size;
  },

  hasSelectedTranscriptions: () => {
    return get().selectedTranscriptionIds.size > 0;
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

  isSessionSelected: (id: string) => {
    return get().selectedSessionIds.has(id);
  },

  getSelectedSessionCount: () => {
    return get().selectedSessionIds.size;
  },

  hasSelectedSessions: () => {
    return get().selectedSessionIds.size > 0;
  },

  showModal: (modalId: string) => {
    const state = get();
    const newModals = new Set(state.visibleModals);
    newModals.add(modalId);
    set({ visibleModals: newModals });
  },

  hideModal: (modalId: string) => {
    const state = get();
    const newModals = new Set(state.visibleModals);
    newModals.delete(modalId);
    set({ visibleModals: newModals });
  },

  isModalVisible: (modalId: string) => {
    return get().visibleModals.has(modalId);
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

  clearAllToasts: () => {
    set({ toasts: [] });
  },

  setLoading: (operation: string, isLoading: boolean) => {
    const state = get();
    const newLoadingStates = new Map(state.loadingStates);
    newLoadingStates.set(operation, isLoading);
    set({ loadingStates: newLoadingStates });
  },

  clearLoading: (operation: string) => {
    const state = get();
    const newLoadingStates = new Map(state.loadingStates);
    newLoadingStates.delete(operation);
    set({ loadingStates: newLoadingStates });
  },

  isLoading: (operation: string) => {
    return get().loadingStates.get(operation) ?? false;
  },

  hasAnyLoading: () => {
    const state = get();
    for (const isLoading of state.loadingStates.values()) {
      if (isLoading) return true;
    }
    return false;
  },

  showGlobalTooltip: (
    message: string,
    variant: GlobalTooltipVariant = 'normal',
    duration: number = DEFAULT_GLOBAL_TOOLTIP_DURATION
  ) => {
    const tooltipId = Crypto.randomUUID();
    set({
      globalTooltip: {
        id: tooltipId,
        message,
        variant,
        duration,
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
// Returns Set directly for O(1) membership checks
export const useSelectedTranscriptionIdsSet = () =>
  useUIStore((s) => s.selectedTranscriptionIds);
export const useSelectedTranscriptionIds = () =>
  useUIStore(useShallow((s) => Array.from(s.selectedTranscriptionIds)));
export const useSelectedTranscriptionCount = () =>
  useUIStore((s) => s.getSelectedTranscriptionCount());

export const useIsSessionSelectionMode = () =>
  useUIStore((s) => s.isSessionSelectionMode);
// Returns Set directly for O(1) membership checks
export const useSelectedSessionIdsSet = () =>
  useUIStore((s) => s.selectedSessionIds);
export const useSelectedSessionIds = () =>
  useUIStore(useShallow((s) => Array.from(s.selectedSessionIds)));
export const useSelectedSessionCount = () =>
  useUIStore((s) => s.getSelectedSessionCount());

export const useVisibleModals = () =>
  useUIStore(useShallow((s) => Array.from(s.visibleModals)));
export const useToasts = () => useUIStore((s) => s.toasts);
export const useHasAnyLoading = () => useUIStore((s) => s.hasAnyLoading());

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

export const useShowModal = () => useUIStore((s) => s.showModal);
export const useHideModal = () => useUIStore((s) => s.hideModal);

export const useShowToast = () => useUIStore((s) => s.showToast);
export const useHideToast = () => useUIStore((s) => s.hideToast);

export const useSetLoading = () => useUIStore((s) => s.setLoading);
export const useClearLoading = () => useUIStore((s) => s.clearLoading);

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
