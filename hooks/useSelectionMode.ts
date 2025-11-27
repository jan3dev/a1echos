import { useCallback, useRef } from 'react';
import { useUIStore } from '../stores/uiStore';

export const useSelectionMode = () => {
  // Transcription Selection
  const isTranscriptionSelectionMode = useUIStore(
    (state) => state.isTranscriptionSelectionMode
  );
  const selectedTranscriptionIds = useUIStore(
    (state) => state.selectedTranscriptionIds
  );
  const toggleTranscriptionSelection = useUIStore(
    (state) => state.toggleTranscriptionSelection
  );
  const selectAllTranscriptions = useUIStore(
    (state) => state.selectAllTranscriptions
  );
  const exitTranscriptionSelection = useUIStore(
    (state) => state.exitTranscriptionSelection
  );

  // Session Selection
  const isSessionSelectionMode = useUIStore(
    (state) => state.isSessionSelectionMode
  );
  const selectedSessionIds = useUIStore((state) => state.selectedSessionIds);
  const toggleSessionSelection = useUIStore(
    (state) => state.toggleSessionSelection
  );
  const exitSessionSelection = useUIStore(
    (state) => state.exitSessionSelection
  );

  // Refs for stable callbacks
  const selectedTranscriptionIdsRef = useRef(selectedTranscriptionIds);
  selectedTranscriptionIdsRef.current = selectedTranscriptionIds;

  const selectedSessionIdsRef = useRef(selectedSessionIds);
  selectedSessionIdsRef.current = selectedSessionIds;

  // Helpers
  const isTranscriptionSelected = useCallback((id: string) => {
    return selectedTranscriptionIdsRef.current.has(id);
  }, []);

  const isSessionSelected = useCallback((id: string) => {
    return selectedSessionIdsRef.current.has(id);
  }, []);

  const transcriptionSelectionCount = selectedTranscriptionIds.size;
  const sessionSelectionCount = selectedSessionIds.size;

  return {
    // Transcription
    isTranscriptionSelectionMode,
    selectedTranscriptionIds: Array.from(selectedTranscriptionIds),
    transcriptionSelectionCount,
    toggleTranscriptionSelection,
    selectAllTranscriptions,
    exitTranscriptionSelection,
    isTranscriptionSelected,

    // Session
    isSessionSelectionMode,
    selectedSessionIds: Array.from(selectedSessionIds),
    sessionSelectionCount,
    toggleSessionSelection,
    exitSessionSelection,
    isSessionSelected,
  };
};
