import { act, renderHook } from "@testing-library/react-native";

import { createSession } from "@/models";
import { useSessionStore, useTranscriptionStore } from "@/stores";

import { useSessionOperations } from "./useSessionOperations";

describe("useSessionOperations", () => {
  const mockDeleteSession = jest.fn().mockResolvedValue(undefined);
  const mockClearIncognitoSession = jest.fn().mockResolvedValue(undefined);
  const mockDeleteAllTranscriptionsForSession = jest
    .fn()
    .mockResolvedValue(undefined);

  beforeEach(() => {
    mockDeleteSession.mockClear();
    mockClearIncognitoSession.mockClear();
    mockDeleteAllTranscriptionsForSession.mockClear();

    useSessionStore.setState({
      deleteSession: mockDeleteSession,
      clearIncognitoSession: mockClearIncognitoSession,
      incognitoSession: null,
    });

    useTranscriptionStore.setState({
      deleteAllTranscriptionsForSession: mockDeleteAllTranscriptionsForSession,
    });
  });

  it("deleteSession calls deleteAllTranscriptionsForSession then deleteSession", async () => {
    const { result } = renderHook(() => useSessionOperations());

    await act(async () => {
      await result.current.deleteSession("session-1");
    });

    expect(mockDeleteAllTranscriptionsForSession).toHaveBeenCalledWith(
      "session-1",
    );
    expect(mockDeleteSession).toHaveBeenCalledWith("session-1");
  });

  it("deleteSession calls transcription deletion before session deletion", async () => {
    const callOrder: string[] = [];
    mockDeleteAllTranscriptionsForSession.mockImplementation(async () => {
      callOrder.push("deleteTranscriptions");
    });
    mockDeleteSession.mockImplementation(async () => {
      callOrder.push("deleteSession");
    });

    const { result } = renderHook(() => useSessionOperations());

    await act(async () => {
      await result.current.deleteSession("session-1");
    });

    expect(callOrder).toEqual(["deleteTranscriptions", "deleteSession"]);
  });

  it("endIncognitoSession deletes transcriptions and clears session when incognito session exists", async () => {
    useSessionStore.setState({
      deleteSession: mockDeleteSession,
      clearIncognitoSession: mockClearIncognitoSession,
      incognitoSession: createSession({
        id: "incognito-1",
        name: "Incognito",
        timestamp: new Date(),
        isIncognito: true,
      }),
    });

    const { result } = renderHook(() => useSessionOperations());

    await act(async () => {
      await result.current.endIncognitoSession();
    });

    expect(mockDeleteAllTranscriptionsForSession).toHaveBeenCalledWith(
      "incognito-1",
    );
    expect(mockClearIncognitoSession).toHaveBeenCalled();
  });

  it("endIncognitoSession is a no-op when no incognito session exists", async () => {
    useSessionStore.setState({
      deleteSession: mockDeleteSession,
      clearIncognitoSession: mockClearIncognitoSession,
      incognitoSession: null,
    });

    const { result } = renderHook(() => useSessionOperations());

    await act(async () => {
      await result.current.endIncognitoSession();
    });

    expect(mockDeleteAllTranscriptionsForSession).not.toHaveBeenCalled();
    expect(mockClearIncognitoSession).not.toHaveBeenCalled();
  });

  it("deleteSession and endIncognitoSession are stable function references", () => {
    const { result, rerender } = renderHook(() => useSessionOperations());

    const first = result.current;
    rerender({});
    const second = result.current;

    expect(first.deleteSession).toBe(second.deleteSession);
    expect(first.endIncognitoSession).toBe(second.endIncognitoSession);
  });
});
