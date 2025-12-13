import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';

import { AppConstants } from '@/constants';
import { Session, createSession } from '@/models';
import { storageService } from '@/services';
import { logWarn } from '@/utils';

interface SessionStore {
  sessions: Session[];
  activeSessionId: string;
  incognitoSession: Session | null;
  isLoaded: boolean;
  needsSort: boolean;

  loadSessions: () => Promise<void>;
  createSession: (
    name?: string,
    isIncognito?: boolean,
    recordingPrefix?: string,
    incognitoModeTitle?: string,
    notifyImmediately?: boolean
  ) => Promise<string>;
  renameSession: (id: string, newName: string) => Promise<void>;
  switchSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  updateSessionModifiedTimestamp: (id: string) => Promise<void>;
  clearIncognitoSession: () => Promise<void>;
  findSessionById: (id: string) => Session | null;
  isActiveSessionIncognito: () => boolean;
  getNewSessionName: (recordingPrefix: string) => string;
  getSessions: () => Session[];
  getActiveSession: () => Session | null;
  notifySessionCreated: () => void;
}

export const useSessionStore = create<SessionStore>((set, get) => {
  const sortSessions = (sessions: Session[]): Session[] => {
    return [...sessions].sort(
      (a, b) => b.lastModified.getTime() - a.lastModified.getTime()
    );
  };

  const saveSessions = async () => {
    const { sessions } = get();
    await storageService.saveSessions(sessions);
  };

  const saveActiveSession = async () => {
    const { activeSessionId } = get();
    if (activeSessionId) {
      await storageService.saveActiveSessionId(activeSessionId);
    } else {
      await storageService.clearActiveSessionId();
    }
  };

  return {
    sessions: [],
    activeSessionId: '',
    incognitoSession: null,
    isLoaded: false,
    needsSort: true,

    loadSessions: async () => {
      const sessions = await storageService.getSessions();
      const storedActive = await storageService.getActiveSessionId();

      let activeSessionId = '';

      if (storedActive && sessions.some((s) => s.id === storedActive)) {
        activeSessionId = storedActive;
      } else if (sessions.length > 0) {
        activeSessionId = sessions[0].id;
        await storageService.saveActiveSessionId(activeSessionId);
      }

      set({
        sessions,
        activeSessionId,
        isLoaded: true,
        needsSort: true,
      });
    },

    getSessions: () => {
      const { sessions, needsSort } = get();
      if (needsSort) {
        const sorted = sortSessions(sessions);
        set({ sessions: sorted, needsSort: false });
        return sorted;
      }
      return sessions;
    },

    getActiveSession: () => {
      const { activeSessionId, incognitoSession, sessions } = get();

      if (incognitoSession && incognitoSession.id === activeSessionId) {
        return incognitoSession;
      }

      const session = sessions.find((s) => s.id === activeSessionId);
      if (session) {
        return session;
      }

      if (sessions.length > 0) {
        return sessions[0];
      }

      return null;
    },

    getNewSessionName: (recordingPrefix: string) => {
      const { sessions } = get();
      const baseName = `${recordingPrefix} `;
      const existingSessionNumbers = sessions
        .filter((s) => s.name.startsWith(baseName))
        .map((s) => {
          const parsed = parseInt(s.name.substring(baseName.length), 10);
          if (isNaN(parsed)) {
            logWarn(`Could not parse session number from name: ${s.name}`);
          }
          return parsed;
        })
        .filter((count): count is number => !isNaN(count));

      let nextNumber = 1;
      if (existingSessionNumbers.length > 0) {
        nextNumber = Math.max(...existingSessionNumbers) + 1;
      }

      return `${baseName}${nextNumber}`;
    },

    createSession: async (
      name?: string,
      isIncognito = false,
      recordingPrefix = 'Session',
      incognitoModeTitle = 'Incognito'
    ) => {
      const now = new Date();
      const sessionId = Crypto.randomUUID();
      let sessionNameToUse = '';

      if (isIncognito) {
        sessionNameToUse = incognitoModeTitle;
      } else {
        if (!name || name.trim() === '') {
          sessionNameToUse = get().getNewSessionName(recordingPrefix);
          if (sessionNameToUse.trim() === '') {
            throw new Error('Session name cannot be empty.');
          }
        } else {
          sessionNameToUse = name.trim();
          if (sessionNameToUse.length > AppConstants.SESSION_NAME_MAX_LENGTH) {
            sessionNameToUse = sessionNameToUse.substring(
              0,
              AppConstants.SESSION_NAME_MAX_LENGTH
            );
          }
        }
      }

      const session = createSession({
        id: sessionId,
        name: sessionNameToUse,
        timestamp: now,
        lastModified: now,
        isIncognito,
      });

      if (isIncognito) {
        set({
          incognitoSession: session,
          activeSessionId: session.id,
        });
        await saveActiveSession();
      } else {
        const { sessions } = get();
        set({
          sessions: [...sessions, session],
          activeSessionId: session.id,
          needsSort: true,
        });
        await saveSessions();
        await saveActiveSession();
      }

      return sessionId;
    },

    notifySessionCreated: () => {
      set({});
    },

    isActiveSessionIncognito: () => {
      const { activeSessionId, incognitoSession, sessions } = get();

      if (incognitoSession && incognitoSession.id === activeSessionId) {
        return true;
      }

      const session = sessions.find((s) => s.id === activeSessionId);
      return session ? session.isIncognito : false;
    },

    renameSession: async (id: string, newName: string) => {
      const { sessions } = get();
      const index = sessions.findIndex((s) => s.id === id);

      if (index >= 0 && newName.trim() !== '') {
        let trimmedName = newName.trim();
        if (trimmedName.length > AppConstants.SESSION_NAME_MAX_LENGTH) {
          trimmedName = trimmedName.substring(
            0,
            AppConstants.SESSION_NAME_MAX_LENGTH
          );
        }

        const updatedSessions = [...sessions];
        updatedSessions[index] = {
          ...updatedSessions[index],
          name: trimmedName,
          lastModified: new Date(),
        };

        set({
          sessions: updatedSessions,
          needsSort: true,
        });

        await saveSessions();
      }
    },

    switchSession: async (id: string) => {
      const { activeSessionId, sessions } = get();

      if (activeSessionId !== id && sessions.some((s) => s.id === id)) {
        set({
          incognitoSession: null,
          activeSessionId: id,
        });
        await saveActiveSession();
      }
    },

    deleteSession: async (id: string) => {
      const { incognitoSession, sessions, activeSessionId } = get();

      if (incognitoSession && incognitoSession.id === id) {
        let newActiveId = '';
        if (sessions.length > 0) {
          const sorted = sortSessions(sessions);
          newActiveId = sorted[0].id;
        }

        set({
          incognitoSession: null,
          activeSessionId: newActiveId,
        });

        if (newActiveId) {
          await saveActiveSession();
        }
        return;
      }

      const updatedSessions = sessions.filter((s) => s.id !== id);
      let newActiveId = activeSessionId;

      if (updatedSessions.length === 0) {
        newActiveId = '';
      } else if (activeSessionId === id) {
        const sorted = sortSessions(updatedSessions);
        newActiveId = sorted[0].id;
      }

      set({
        sessions: updatedSessions,
        activeSessionId: newActiveId,
        needsSort: true,
      });

      await saveSessions();
      if (activeSessionId === id && newActiveId) {
        await saveActiveSession();
      }
    },

    updateSessionModifiedTimestamp: async (sessionId: string) => {
      const { incognitoSession, sessions } = get();

      if (incognitoSession && incognitoSession.id === sessionId) {
        set({
          incognitoSession: {
            ...incognitoSession,
            lastModified: new Date(),
          },
        });
        return;
      }

      const index = sessions.findIndex((s) => s.id === sessionId);
      if (index >= 0) {
        const updatedSessions = [...sessions];
        updatedSessions[index] = {
          ...updatedSessions[index],
          lastModified: new Date(),
        };

        set({
          sessions: updatedSessions,
          needsSort: true,
        });

        await saveSessions();
      }
    },

    clearIncognitoSession: async () => {
      const { incognitoSession, sessions } = get();

      if (incognitoSession) {
        let newActiveId = '';
        if (sessions.length > 0) {
          const sorted = sortSessions(sessions);
          newActiveId = sorted[0].id;
        }

        set({
          incognitoSession: null,
          activeSessionId: newActiveId,
        });

        if (newActiveId) {
          await saveActiveSession();
        }
      }
    },

    findSessionById: (id: string) => {
      const { incognitoSession, sessions } = get();

      if (incognitoSession && incognitoSession.id === id) {
        return incognitoSession;
      }

      return sessions.find((s) => s.id === id) || null;
    },
  };
});

export const initializeSessionStore = async (): Promise<void> => {
  await useSessionStore.getState().loadSessions();
};
export const useSessions = () =>
  useSessionStore(useShallow((s) => s.getSessions()));
export const useCreateSession = () => useSessionStore((s) => s.createSession);
export const useRenameSession = () => useSessionStore((s) => s.renameSession);
export const useFindSessionById = () =>
  useSessionStore((s) => s.findSessionById);
export const useSwitchSession = () => useSessionStore((s) => s.switchSession);
export const useIncognitoSession = () =>
  useSessionStore((s) => s.incognitoSession);

export default useSessionStore;
