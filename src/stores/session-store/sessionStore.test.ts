import { renderHook } from "@testing-library/react-native";
import * as Crypto from "expo-crypto";

import { Session } from "@/models";
import { audioProtectionService, databaseService } from "@/services";

import {
  useCreateSession,
  useFindSessionById,
  useIncognitoSession,
  useRenameSession,
  useSessions,
  useSessionStore,
  useSwitchSession,
} from "./sessionStore";

jest.mock("@/services", () => ({
  databaseService: {
    listSessions: jest.fn(async () => []),
    upsertSession: jest.fn(async () => undefined),
    deleteSession: jest.fn(async () => ({ deletedAudioPaths: [] })),
    getActiveSessionId: jest.fn(async () => null),
    setActiveSessionId: jest.fn(async () => undefined),
  },
  audioProtectionService: {
    deleteAudio: jest.fn(async () => undefined),
  },
}));

jest.mock("@/utils", () => ({
  FeatureFlag: { session: "SESSION" },
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

const makeSession = (
  overrides: Partial<Session> & { id: string; name: string },
): Session => ({
  timestamp: new Date("2024-01-01"),
  lastModified: new Date("2024-01-01"),
  isIncognito: false,
  ...overrides,
});

const s1 = makeSession({
  id: "s1",
  name: "Session 1",
  lastModified: new Date("2024-01-03"),
});
const s2 = makeSession({
  id: "s2",
  name: "Session 2",
  lastModified: new Date("2024-01-02"),
});
const s3 = makeSession({
  id: "s3",
  name: "Other",
  lastModified: new Date("2024-01-01"),
});

const initialState = {
  sessions: [],
  activeSessionId: "",
  incognitoSession: null,
  isLoaded: false,
  needsSort: true,
};

describe("sessionStore", () => {
  beforeEach(() => {
    useSessionStore.setState(initialState);
    (Crypto.randomUUID as jest.Mock).mockReturnValue("new-uuid");
  });

  describe("initial state", () => {
    it("has correct defaults", () => {
      const state = useSessionStore.getState();
      expect(state.sessions).toEqual([]);
      expect(state.activeSessionId).toBe("");
      expect(state.incognitoSession).toBeNull();
      expect(state.isLoaded).toBe(false);
    });
  });

  describe("loadSessions()", () => {
    it("loads sessions from storage and restores active ID", async () => {
      (databaseService.listSessions as jest.Mock).mockResolvedValueOnce([
        s1,
        s2,
      ]);
      (databaseService.getActiveSessionId as jest.Mock).mockResolvedValueOnce(
        "s2",
      );

      await useSessionStore.getState().loadSessions();
      const state = useSessionStore.getState();

      expect(state.sessions).toHaveLength(2);
      expect(state.activeSessionId).toBe("s2");
      expect(state.isLoaded).toBe(true);
    });

    it("falls back to first session when stored active ID is missing", async () => {
      (databaseService.listSessions as jest.Mock).mockResolvedValueOnce([
        s1,
        s2,
      ]);
      (databaseService.getActiveSessionId as jest.Mock).mockResolvedValueOnce(
        "nonexistent",
      );

      await useSessionStore.getState().loadSessions();
      expect(useSessionStore.getState().activeSessionId).toBe("s1");
      expect(databaseService.setActiveSessionId).toHaveBeenCalledWith("s1");
    });

    it("handles empty session list", async () => {
      (databaseService.listSessions as jest.Mock).mockResolvedValueOnce([]);
      (databaseService.getActiveSessionId as jest.Mock).mockResolvedValueOnce(
        null,
      );

      await useSessionStore.getState().loadSessions();
      const state = useSessionStore.getState();

      expect(state.sessions).toEqual([]);
      expect(state.activeSessionId).toBe("");
      expect(state.isLoaded).toBe(true);
    });
  });

  describe("getSessions()", () => {
    it("lazy-sorts sessions by lastModified descending", () => {
      useSessionStore.setState({
        sessions: [s3, s1, s2],
        needsSort: true,
      });

      const sorted = useSessionStore.getState().getSessions();
      expect(sorted[0].id).toBe("s1");
      expect(sorted[1].id).toBe("s2");
      expect(sorted[2].id).toBe("s3");
    });

    it("returns cached sorted list on subsequent calls", () => {
      useSessionStore.setState({
        sessions: [s3, s1, s2],
        needsSort: true,
      });

      useSessionStore.getState().getSessions();
      expect(useSessionStore.getState().needsSort).toBe(false);

      const result = useSessionStore.getState().getSessions();
      expect(result[0].id).toBe("s1");
    });
  });

  describe("getActiveSession()", () => {
    it("returns incognito session when it matches active ID", () => {
      const incognito = makeSession({
        id: "inc",
        name: "Incognito",
        isIncognito: true,
      });
      useSessionStore.setState({
        sessions: [s1],
        activeSessionId: "inc",
        incognitoSession: incognito,
      });

      expect(useSessionStore.getState().getActiveSession()).toEqual(incognito);
    });

    it("returns regular session matching active ID", () => {
      useSessionStore.setState({
        sessions: [s1, s2],
        activeSessionId: "s2",
      });

      expect(useSessionStore.getState().getActiveSession()!.id).toBe("s2");
    });

    it("falls back to first session when active ID not found", () => {
      useSessionStore.setState({
        sessions: [s1, s2],
        activeSessionId: "nonexistent",
      });

      expect(useSessionStore.getState().getActiveSession()!.id).toBe("s1");
    });

    it("returns null when no sessions exist", () => {
      useSessionStore.setState({
        sessions: [],
        activeSessionId: "",
      });

      expect(useSessionStore.getState().getActiveSession()).toBeNull();
    });
  });

  describe("getNewSessionName()", () => {
    it('returns "Session 1" for empty store', () => {
      expect(useSessionStore.getState().getNewSessionName("Session")).toBe(
        "Session 1",
      );
    });

    it("increments from max existing number", () => {
      useSessionStore.setState({ sessions: [s1, s2] });
      expect(useSessionStore.getState().getNewSessionName("Session")).toBe(
        "Session 3",
      );
    });

    it("ignores sessions with non-matching prefix", () => {
      useSessionStore.setState({ sessions: [s3] });
      expect(useSessionStore.getState().getNewSessionName("Session")).toBe(
        "Session 1",
      );
    });
  });

  describe("createSession()", () => {
    it("creates with auto-generated name", async () => {
      const id = await useSessionStore.getState().createSession();

      expect(id).toBe("new-uuid");
      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0].name).toBe("Session 1");
      expect(state.activeSessionId).toBe("new-uuid");
      expect(databaseService.upsertSession).toHaveBeenCalled();
      expect(databaseService.setActiveSessionId).toHaveBeenCalledWith(
        "new-uuid",
      );
    });

    it("creates with provided name", async () => {
      await useSessionStore.getState().createSession("My Session");
      expect(useSessionStore.getState().sessions[0].name).toBe("My Session");
    });

    it("truncates long names", async () => {
      const longName = "A".repeat(50);
      await useSessionStore.getState().createSession(longName);
      expect(useSessionStore.getState().sessions[0].name).toHaveLength(30);
    });

    it("creates incognito session separately", async () => {
      const id = await useSessionStore
        .getState()
        .createSession(undefined, true, "Session", "Incognito");

      const state = useSessionStore.getState();
      expect(state.incognitoSession).not.toBeNull();
      expect(state.incognitoSession!.name).toBe("Incognito");
      expect(state.incognitoSession!.isIncognito).toBe(true);
      expect(state.activeSessionId).toBe(id);
      // Incognito sessions don't write to the DB.
      expect(databaseService.upsertSession).not.toHaveBeenCalled();
    });

    it("persists non-incognito session to storage", async () => {
      await useSessionStore.getState().createSession("Test");
      expect(databaseService.upsertSession).toHaveBeenCalled();
      expect(databaseService.setActiveSessionId).toHaveBeenCalled();
    });
  });

  describe("renameSession()", () => {
    beforeEach(() => {
      useSessionStore.setState({ sessions: [s1, s2] });
    });

    it("renames and trims the name", async () => {
      await useSessionStore.getState().renameSession("s1", "  New Name  ");
      const session = useSessionStore
        .getState()
        .sessions.find((s) => s.id === "s1")!;
      expect(session.name).toBe("New Name");
      expect(databaseService.upsertSession).toHaveBeenCalled();
    });

    it("truncates long names", async () => {
      await useSessionStore.getState().renameSession("s1", "A".repeat(50));
      const session = useSessionStore
        .getState()
        .sessions.find((s) => s.id === "s1")!;
      expect(session.name).toHaveLength(30);
    });

    it("skips rename for not-found session", async () => {
      await useSessionStore.getState().renameSession("nonexistent", "Name");
      expect(databaseService.upsertSession).not.toHaveBeenCalled();
    });

    it("skips rename for empty name", async () => {
      await useSessionStore.getState().renameSession("s1", "   ");
      expect(databaseService.upsertSession).not.toHaveBeenCalled();
    });
  });

  describe("switchSession()", () => {
    beforeEach(() => {
      useSessionStore.setState({ sessions: [s1, s2], activeSessionId: "s1" });
    });

    it("switches active session and clears incognito", async () => {
      const incognito = makeSession({
        id: "inc",
        name: "Incognito",
        isIncognito: true,
      });
      useSessionStore.setState({ incognitoSession: incognito });

      await useSessionStore.getState().switchSession("s2");
      const state = useSessionStore.getState();

      expect(state.activeSessionId).toBe("s2");
      expect(state.incognitoSession).toBeNull();
      expect(databaseService.setActiveSessionId).toHaveBeenCalledWith("s2");
    });

    it("no-ops when switching to same session", async () => {
      await useSessionStore.getState().switchSession("s1");
      expect(databaseService.setActiveSessionId).not.toHaveBeenCalled();
    });

    it("no-ops when switching to nonexistent session", async () => {
      await useSessionStore.getState().switchSession("nonexistent");
      expect(useSessionStore.getState().activeSessionId).toBe("s1");
      expect(databaseService.setActiveSessionId).not.toHaveBeenCalled();
    });
  });

  describe("deleteSession()", () => {
    it("deletes incognito session and reassigns active", async () => {
      const incognito = makeSession({
        id: "inc",
        name: "Incognito",
        isIncognito: true,
      });
      useSessionStore.setState({
        sessions: [s1],
        activeSessionId: "inc",
        incognitoSession: incognito,
      });

      await useSessionStore.getState().deleteSession("inc");
      const state = useSessionStore.getState();

      expect(state.incognitoSession).toBeNull();
      expect(state.activeSessionId).toBe("s1");
      // Incognito sessions are never in the DB, so no cascade call.
      expect(databaseService.deleteSession).not.toHaveBeenCalled();
    });

    it("deletes active session and cascades audio cleanup", async () => {
      useSessionStore.setState({
        sessions: [s1, s2],
        activeSessionId: "s1",
      });
      (databaseService.deleteSession as jest.Mock).mockResolvedValueOnce({
        deletedAudioPaths: ["/path/a.wav", "/path/b.wav"],
      });

      await useSessionStore.getState().deleteSession("s1");
      const state = useSessionStore.getState();

      expect(state.sessions).toHaveLength(1);
      expect(state.activeSessionId).toBe("s2");
      expect(databaseService.deleteSession).toHaveBeenCalledWith("s1");
      expect(audioProtectionService.deleteAudio).toHaveBeenCalledTimes(2);
    });

    it("deletes non-active session without changing active", async () => {
      useSessionStore.setState({
        sessions: [s1, s2],
        activeSessionId: "s1",
      });

      await useSessionStore.getState().deleteSession("s2");
      const state = useSessionStore.getState();

      expect(state.sessions).toHaveLength(1);
      expect(state.activeSessionId).toBe("s1");
    });

    it("deletes last session and clears active ID", async () => {
      useSessionStore.setState({
        sessions: [s1],
        activeSessionId: "s1",
      });

      await useSessionStore.getState().deleteSession("s1");
      const state = useSessionStore.getState();

      expect(state.sessions).toHaveLength(0);
      expect(state.activeSessionId).toBe("");
    });
  });

  describe("updateSessionModifiedTimestamp()", () => {
    it("updates incognito session timestamp in memory only", async () => {
      const incognito = makeSession({
        id: "inc",
        name: "Incognito",
        isIncognito: true,
        lastModified: new Date("2024-01-01"),
      });
      useSessionStore.setState({ incognitoSession: incognito });

      await useSessionStore.getState().updateSessionModifiedTimestamp("inc");

      expect(
        useSessionStore.getState().incognitoSession!.lastModified.getTime(),
      ).toBeGreaterThan(new Date("2024-01-01").getTime());
      expect(databaseService.upsertSession).not.toHaveBeenCalled();
    });

    it("updates regular session and persists", async () => {
      useSessionStore.setState({ sessions: [s1] });

      await useSessionStore.getState().updateSessionModifiedTimestamp("s1");

      expect(databaseService.upsertSession).toHaveBeenCalled();
      expect(useSessionStore.getState().needsSort).toBe(true);
    });
  });

  describe("clearIncognitoSession()", () => {
    it("clears incognito and reassigns active to regular session", async () => {
      const incognito = makeSession({
        id: "inc",
        name: "Incognito",
        isIncognito: true,
      });
      useSessionStore.setState({
        sessions: [s1],
        activeSessionId: "inc",
        incognitoSession: incognito,
      });

      await useSessionStore.getState().clearIncognitoSession();
      const state = useSessionStore.getState();

      expect(state.incognitoSession).toBeNull();
      expect(state.activeSessionId).toBe("s1");
    });

    it("no-ops when no incognito session exists", async () => {
      useSessionStore.setState({ sessions: [s1], activeSessionId: "s1" });

      await useSessionStore.getState().clearIncognitoSession();
      expect(useSessionStore.getState().activeSessionId).toBe("s1");
    });
  });

  describe("findSessionById()", () => {
    it("finds incognito session", () => {
      const incognito = makeSession({
        id: "inc",
        name: "Incognito",
        isIncognito: true,
      });
      useSessionStore.setState({ incognitoSession: incognito });

      expect(useSessionStore.getState().findSessionById("inc")).toEqual(
        incognito,
      );
    });

    it("finds regular session", () => {
      useSessionStore.setState({ sessions: [s1, s2] });
      expect(useSessionStore.getState().findSessionById("s2")!.id).toBe("s2");
    });

    it("returns null when not found", () => {
      useSessionStore.setState({ sessions: [s1] });
      expect(
        useSessionStore.getState().findSessionById("nonexistent"),
      ).toBeNull();
    });
  });

  describe("isActiveSessionIncognito()", () => {
    it("returns true when active session is incognito", () => {
      const incognito = makeSession({
        id: "inc",
        name: "Incognito",
        isIncognito: true,
      });
      useSessionStore.setState({
        activeSessionId: "inc",
        incognitoSession: incognito,
      });

      expect(useSessionStore.getState().isActiveSessionIncognito()).toBe(true);
    });

    it("returns false when active session is regular", () => {
      useSessionStore.setState({
        sessions: [s1],
        activeSessionId: "s1",
      });

      expect(useSessionStore.getState().isActiveSessionIncognito()).toBe(false);
    });
  });

  describe("notifySessionCreated()", () => {
    it("triggers store update without changing state", () => {
      useSessionStore.setState({ sessions: [s1], activeSessionId: "s1" });
      useSessionStore.getState().notifySessionCreated();
      expect(useSessionStore.getState().sessions).toHaveLength(1);
    });
  });

  describe("selector hooks", () => {
    it("useSessions returns empty array by default", () => {
      const { result } = renderHook(() => useSessions());
      expect(result.current).toEqual([]);
    });

    it("useCreateSession returns a function", () => {
      const { result } = renderHook(() => useCreateSession());
      expect(typeof result.current).toBe("function");
    });

    it("useRenameSession returns a function", () => {
      const { result } = renderHook(() => useRenameSession());
      expect(typeof result.current).toBe("function");
    });

    it("useFindSessionById returns a function", () => {
      const { result } = renderHook(() => useFindSessionById());
      expect(typeof result.current).toBe("function");
    });

    it("useSwitchSession returns a function", () => {
      const { result } = renderHook(() => useSwitchSession());
      expect(typeof result.current).toBe("function");
    });

    it("useIncognitoSession returns null by default", () => {
      const { result } = renderHook(() => useIncognitoSession());
      expect(result.current).toBeNull();
    });
  });
});
