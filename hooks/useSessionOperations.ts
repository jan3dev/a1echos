import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSessionStore } from '../stores/sessionStore';
import { useTranscriptionStore } from '../stores/transcriptionStore';

export const useSessionOperations = () => {
  // Store actions
  const createSessionAction = useSessionStore((state) => state.createSession);
  const deleteSessionAction = useSessionStore((state) => state.deleteSession);
  const renameSessionAction = useSessionStore((state) => state.renameSession);
  const switchSessionAction = useSessionStore((state) => state.switchSession);
  const clearIncognitoSessionAction = useSessionStore(
    (state) => state.clearIncognitoSession
  );

  // Store state
  const sessions = useSessionStore(useShallow((state) => state.getSessions()));
  const activeSession = useSessionStore(
    useShallow((state) => state.getActiveSession())
  );
  const isIncognito = useSessionStore((state) =>
    state.isActiveSessionIncognito()
  );
  const incognitoSession = useSessionStore((state) => state.incognitoSession);

  // Cross-store actions (e.g., cleanup transcriptions on delete)
  const deleteAllTranscriptionsForSession = useTranscriptionStore(
    (state) => state.deleteAllTranscriptionsForSession
  );

  const createSession = useCallback(
    async (name?: string, isIncognitoSession?: boolean) => {
      return await createSessionAction(name, isIncognitoSession);
    },
    [createSessionAction]
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      // 1. Delete transcriptions first
      await deleteAllTranscriptionsForSession(sessionId);
      // 2. Delete session
      await deleteSessionAction(sessionId);
    },
    [deleteAllTranscriptionsForSession, deleteSessionAction]
  );

  const renameSession = useCallback(
    async (sessionId: string, newName: string) => {
      await renameSessionAction(sessionId, newName);
    },
    [renameSessionAction]
  );

  const switchSession = useCallback(
    async (sessionId: string) => {
      await switchSessionAction(sessionId);
    },
    [switchSessionAction]
  );

  const endIncognitoSession = useCallback(async () => {
    if (incognitoSession) {
      // Clean up transcriptions for incognito session before clearing it
      // Note: The store might handle this, but explicit cleanup is safer
      await deleteAllTranscriptionsForSession(incognitoSession.id);
      await clearIncognitoSessionAction();
    }
  }, [
    incognitoSession,
    deleteAllTranscriptionsForSession,
    clearIncognitoSessionAction,
  ]);

  return {
    sessions,
    activeSession,
    isIncognito,
    createSession,
    deleteSession,
    renameSession,
    switchSession,
    endIncognitoSession,
  };
};
