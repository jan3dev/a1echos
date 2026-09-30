import * as Crypto from "expo-crypto";
import { useMemo } from "react";
import { create } from "zustand";
import { useShallow } from "zustand/shallow";

import { AppConstants } from "@/constants";
import { Folder, FolderSummary, Session, createSession } from "@/models";
import { audioProtectionService, databaseService } from "@/services";
import { FeatureFlag, logError, logWarn } from "@/utils";

const normalizeName = (name: string) =>
  name.trim().substring(0, AppConstants.SESSION_NAME_MAX_LENGTH);

interface SessionStore {
  sessions: Session[];
  folders: Folder[];
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
    folderId?: string,
  ) => Promise<string>;
  createFolder: (name: string) => Promise<string>;
  renameFolder: (id: string, newName: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
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
      (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
    );
  };

  const saveActiveSession = async () => {
    const { activeSessionId } = get();
    await databaseService.setActiveSessionId(activeSessionId || null);
  };

  return {
    sessions: [],
    folders: [],
    activeSessionId: "",
    incognitoSession: null,
    isLoaded: false,
    needsSort: true,

    loadSessions: async () => {
      const [sessions, folders, storedActive] = await Promise.all([
        databaseService.listSessions(),
        databaseService.listFolders(),
        databaseService.getActiveSessionId(),
      ]);

      let activeSessionId = "";

      if (storedActive && sessions.some((s) => s.id === storedActive)) {
        activeSessionId = storedActive;
      } else if (sessions.length > 0) {
        activeSessionId = sessions[0].id;
        await databaseService.setActiveSessionId(activeSessionId);
      }

      set({
        sessions,
        folders,
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
      recordingPrefix = "Session",
      incognitoModeTitle = "Incognito",
      folderId?: string,
    ) => {
      const now = new Date();
      const sessionId = Crypto.randomUUID();
      let sessionNameToUse = "";

      if (isIncognito) {
        sessionNameToUse = incognitoModeTitle;
      } else {
        if (!name || name.trim() === "") {
          sessionNameToUse = get().getNewSessionName(recordingPrefix);
          if (sessionNameToUse.trim() === "") {
            throw new Error("Session name cannot be empty.");
          }
        } else {
          sessionNameToUse = normalizeName(name);
        }
      }

      const session = createSession({
        id: sessionId,
        name: sessionNameToUse,
        timestamp: now,
        lastModified: now,
        isIncognito,
        folderId:
          !isIncognito && get().folders.some((f) => f.id === folderId)
            ? folderId
            : undefined,
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
        await databaseService.upsertSession(session);
        await saveActiveSession();
      }

      return sessionId;
    },

    createFolder: async (name: string) => {
      const trimmed = normalizeName(name);
      if (trimmed === "") throw new Error("Folder name cannot be empty.");
      const folder: Folder = {
        id: Crypto.randomUUID(),
        name: trimmed,
        createdAt: new Date(),
      };
      await databaseService.insertFolder(folder);
      set({ folders: [folder, ...get().folders] });
      return folder.id;
    },

    renameFolder: async (id: string, newName: string) => {
      const name = normalizeName(newName);
      if (name === "") return;
      await databaseService.renameFolder(id, name);
      set({
        folders: get().folders.map((f) => (f.id === id ? { ...f, name } : f)),
      });
    },

    // Sessions left in the folder fall back to the root (FK `set null`).
    deleteFolder: async (id: string) => {
      await databaseService.deleteFolder(id);
      set({
        folders: get().folders.filter((f) => f.id !== id),
        sessions: get().sessions.map((s) =>
          s.folderId === id ? { ...s, folderId: undefined } : s,
        ),
      });
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

      if (index >= 0 && newName.trim() !== "") {
        const trimmedName = normalizeName(newName);

        const updated: Session = {
          ...sessions[index],
          name: trimmedName,
          lastModified: new Date(),
        };
        const updatedSessions = [...sessions];
        updatedSessions[index] = updated;

        set({
          sessions: updatedSessions,
          needsSort: true,
        });

        await databaseService.upsertSession(updated);
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
      const { incognitoSession, sessions } = get();

      if (incognitoSession && incognitoSession.id === id) {
        let newActiveId = "";
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

      // FK cascade deletes transcriptions; service returns audio paths whose
      // file lifecycle is managed by audioProtectionService. Do the DB delete
      // FIRST so a failure leaves the in-memory state and UI consistent
      // instead of optimistically lying about a session that's still on disk.
      let deletedAudioPaths: string[] = [];
      try {
        ({ deletedAudioPaths } = await databaseService.deleteSession(id));
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.session,
          message: `Failed to delete session ${id} from database`,
        });
        throw new Error(`Failed to delete session: ${error}`);
      }

      // Re-read after the await: parallel deletes would otherwise each write
      // back their own stale snapshot and resurrect each other's sessions.
      const { activeSessionId } = get();
      const updatedSessions = get().sessions.filter((s) => s.id !== id);
      let newActiveId = activeSessionId;

      if (updatedSessions.length === 0) {
        newActiveId = "";
      } else if (activeSessionId === id) {
        const sorted = sortSessions(updatedSessions);
        newActiveId = sorted[0].id;
      }

      set({
        sessions: updatedSessions,
        activeSessionId: newActiveId,
        needsSort: true,
      });

      await Promise.allSettled(
        deletedAudioPaths.map((p) => audioProtectionService.deleteAudio(p)),
      );

      if (activeSessionId === id) {
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
        const updated: Session = {
          ...sessions[index],
          lastModified: new Date(),
        };
        const updatedSessions = [...sessions];
        updatedSessions[index] = updated;

        set({
          sessions: updatedSessions,
          needsSort: true,
        });

        await databaseService.upsertSession(updated);
      }
    },

    clearIncognitoSession: async () => {
      const { incognitoSession, sessions } = get();

      if (incognitoSession) {
        let newActiveId = "";
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
export const useFolderSessions = (folderId: string | null) =>
  useSessionStore(
    useShallow((s) =>
      s
        .getSessions()
        .filter((session) => (session.folderId ?? null) === folderId),
    ),
  );
export const useFolders = () => useSessionStore((s) => s.folders);
export const useFolderSummaries = (): FolderSummary[] => {
  const folders = useFolders();
  const counts = useSessionStore(
    useShallow((s) => {
      const byFolder: Record<string, number> = {};
      for (const session of s.sessions) {
        if (session.folderId) {
          byFolder[session.folderId] = (byFolder[session.folderId] ?? 0) + 1;
        }
      }
      return byFolder;
    }),
  );
  return useMemo(
    () =>
      folders.map((folder) => ({
        ...folder,
        sessionCount: counts[folder.id] ?? 0,
      })),
    [folders, counts],
  );
};
export const useFindFolderById = (id: string) =>
  useSessionStore((s) => s.folders.find((f) => f.id === id) ?? null);
export const useCreateFolder = () => useSessionStore((s) => s.createFolder);
export const useRenameFolder = () => useSessionStore((s) => s.renameFolder);
export const useDeleteFolder = () => useSessionStore((s) => s.deleteFolder);
export const useCreateSession = () => useSessionStore((s) => s.createSession);
export const useRenameSession = () => useSessionStore((s) => s.renameSession);
export const useFindSessionById = () =>
  useSessionStore((s) => s.findSessionById);
export const useSwitchSession = () => useSessionStore((s) => s.switchSession);
export const useIncognitoSession = () =>
  useSessionStore((s) => s.incognitoSession);

export default useSessionStore;
