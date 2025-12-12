import { useSessionStore, useTranscriptionStore } from '@/stores';
import { useCallback } from 'react';

export const useSessionOperations = () => {
  const deleteSessionAction = useSessionStore((state) => state.deleteSession);
  const clearIncognitoSessionAction = useSessionStore(
    (state) => state.clearIncognitoSession
  );

  const incognitoSession = useSessionStore((state) => state.incognitoSession);

  const deleteAllTranscriptionsForSession = useTranscriptionStore(
    (state) => state.deleteAllTranscriptionsForSession
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      await deleteAllTranscriptionsForSession(sessionId);
      await deleteSessionAction(sessionId);
    },
    [deleteAllTranscriptionsForSession, deleteSessionAction]
  );

  const endIncognitoSession = useCallback(async () => {
    if (incognitoSession) {
      await deleteAllTranscriptionsForSession(incognitoSession.id);
      await clearIncognitoSessionAction();
    }
  }, [
    incognitoSession,
    deleteAllTranscriptionsForSession,
    clearIncognitoSessionAction,
  ]);

  return {
    deleteSession,
    endIncognitoSession,
  };
};
