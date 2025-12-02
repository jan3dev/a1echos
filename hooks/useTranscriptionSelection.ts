import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { shareService } from '../services/ShareService';
import {
  useSessionTranscriptions,
  useTranscriptionStore,
} from '../stores/transcriptionStore';
import {
  useIsTranscriptionSelectionMode,
  useSelectedTranscriptionIds,
  useSelectedTranscriptionIdsSet,
  useUIStore,
} from '../stores/uiStore';

interface UseTranscriptionSelectionResult {
  selectionMode: boolean;
  selectedTranscriptionIds: Set<string>;
  selectedTranscriptionIdsArray: string[];
  hasSelectedItems: boolean;
  selectedCount: number;
  toggleTranscriptionSelection: (id: string) => void;
  handleLongPress: (id: string) => Promise<void>;
  selectAllTranscriptions: () => void;
  exitSelectionMode: () => void;
  deleteSelectedTranscriptions: () => Promise<{ deleted: number }>;
  copyAllTranscriptions: () => Promise<boolean>;
  shareSelectedTranscriptions: () => Promise<boolean>;
}

export const useTranscriptionSelection = (
  sessionId?: string
): UseTranscriptionSelectionResult => {
  const selectionMode = useIsTranscriptionSelectionMode();
  const selectedIds = useSelectedTranscriptionIdsSet();
  const selectedIdsArray = useSelectedTranscriptionIds();
  const transcriptions = useSessionTranscriptions(sessionId);

  const toggleSelection = useUIStore((s) => s.toggleTranscriptionSelection);
  const selectAll = useUIStore((s) => s.selectAllTranscriptions);
  const exitSelection = useUIStore((s) => s.exitTranscriptionSelection);

  const deleteTranscriptions = useTranscriptionStore(
    (s) => s.deleteTranscriptions
  );

  const handleLongPress = useCallback(
    async (id: string) => {
      if (!selectionMode) {
        toggleSelection(id);
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } catch {
          // Haptics not supported
        }
      } else {
        toggleSelection(id);
      }
    },
    [selectionMode, toggleSelection]
  );

  const selectAllTranscriptions = useCallback(() => {
    const ids = transcriptions.map((t) => t.id);
    selectAll(ids);
  }, [transcriptions, selectAll]);

  const deleteSelectedTranscriptions = useCallback(async () => {
    if (selectedIds.size === 0) {
      return { deleted: 0 };
    }

    const count = selectedIds.size;
    try {
      await deleteTranscriptions(selectedIds);
      return { deleted: count };
    } catch (error) {
      console.error('Failed to delete transcriptions:', error);
      throw error;
    } finally {
      exitSelection();
    }
  }, [selectedIds, deleteTranscriptions, exitSelection]);

  const copyAllTranscriptions = useCallback(async () => {
    if (transcriptions.length === 0) {
      return false;
    }

    const text = transcriptions.map((t) => t.text).join('\n\n');

    try {
      await Clipboard.setStringAsync(text);
      return true;
    } catch (error) {
      console.error('Failed to copy transcriptions:', error);
      return false;
    }
  }, [transcriptions]);

  const shareSelectedTranscriptions = useCallback(async () => {
    if (selectedIds.size === 0) {
      return false;
    }

    const selectedTranscriptions = transcriptions.filter((t) =>
      selectedIds.has(t.id)
    );

    if (selectedTranscriptions.length === 0) {
      return false;
    }

    try {
      await shareService.shareTranscriptions(selectedTranscriptions);
      exitSelection();
      return true;
    } catch (error) {
      console.error('Failed to share transcriptions:', error);
      return false;
    }
  }, [selectedIds, transcriptions, exitSelection]);

  return {
    selectionMode,
    selectedTranscriptionIds: selectedIds,
    selectedTranscriptionIdsArray: selectedIdsArray,
    hasSelectedItems: selectedIds.size > 0,
    selectedCount: selectedIds.size,
    toggleTranscriptionSelection: toggleSelection,
    handleLongPress,
    selectAllTranscriptions,
    exitSelectionMode: exitSelection,
    deleteSelectedTranscriptions,
    copyAllTranscriptions,
    shareSelectedTranscriptions,
  };
};
