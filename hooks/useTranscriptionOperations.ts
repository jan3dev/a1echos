import { useCallback } from 'react';
import { Transcription } from '../models/Transcription';
import { useTranscriptionStore } from '../stores/transcriptionStore';

export const useTranscriptionOperations = () => {
  const deleteTranscriptionAction = useTranscriptionStore(
    (state) => state.deleteTranscription
  );
  const updateTranscriptionAction = useTranscriptionStore(
    (state) => state.updateTranscription
  );
  const deleteParagraphAction = useTranscriptionStore(
    (state) => state.deleteParagraphFromTranscription
  );

  const deleteTranscription = useCallback(
    async (id: string) => {
      await deleteTranscriptionAction(id);
    },
    [deleteTranscriptionAction]
  );

  const updateTranscription = useCallback(
    async (transcription: Transcription) => {
      await updateTranscriptionAction(transcription);
    },
    [updateTranscriptionAction]
  );

  const deleteParagraph = useCallback(
    async (transcriptionId: string, paragraphIndex: number) => {
      await deleteParagraphAction(transcriptionId, paragraphIndex);
    },
    [deleteParagraphAction]
  );

  return {
    deleteTranscription,
    updateTranscription,
    deleteParagraph,
  };
};
