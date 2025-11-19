import * as Crypto from 'expo-crypto';
import { create } from 'zustand';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface UIStore {
  isTranscriptionSelectionMode: boolean;
  selectedTranscriptionIds: Set<string>;
  isSessionSelectionMode: boolean;
  selectedSessionIds: Set<string>;
  visibleModals: Set<string>;
  toasts: Toast[];
  loadingStates: Map<string, boolean>;

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

export const useUIStore = create<UIStore>((set, get) => ({
  isTranscriptionSelectionMode: false,
  selectedTranscriptionIds: new Set(),
  isSessionSelectionMode: false,
  selectedSessionIds: new Set(),
  visibleModals: new Set(),
  toasts: [],
  loadingStates: new Map(),

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
}));

export const useIsTranscriptionSelectionMode = () =>
  useUIStore((s) => s.isTranscriptionSelectionMode);
export const useSelectedTranscriptionIds = () =>
  useUIStore((s) => Array.from(s.selectedTranscriptionIds));
export const useSelectedTranscriptionCount = () =>
  useUIStore((s) => s.getSelectedTranscriptionCount());

export const useIsSessionSelectionMode = () =>
  useUIStore((s) => s.isSessionSelectionMode);
export const useSelectedSessionIds = () =>
  useUIStore((s) => Array.from(s.selectedSessionIds));
export const useSelectedSessionCount = () =>
  useUIStore((s) => s.getSelectedSessionCount());

export const useVisibleModals = () =>
  useUIStore((s) => Array.from(s.visibleModals));
export const useToasts = () => useUIStore((s) => s.toasts);
export const useHasAnyLoading = () => useUIStore((s) => s.hasAnyLoading());

export default useUIStore;
