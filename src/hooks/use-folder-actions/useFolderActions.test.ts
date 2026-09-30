/* eslint-disable @typescript-eslint/no-require-imports */
import { act, renderHook } from "@testing-library/react-native";

import { useFolderActions } from "./useFolderActions";

const mockRenameFolder = jest.fn(async () => undefined);
const mockDeleteFolder = jest.fn(async () => undefined);
const mockShowGlobalTooltip = jest.fn();
const mockDeleteSession = jest.fn(async () => undefined);
let mockSessions: any[] = [];

jest.mock("@/stores", () => ({
  useRenameFolder: () => mockRenameFolder,
  useDeleteFolder: () => mockDeleteFolder,
  useShowGlobalTooltip: () => mockShowGlobalTooltip,
  useSessionStore: {
    getState: () => ({
      sessions: mockSessions,
      getSessions: () => mockSessions,
    }),
  },
}));

jest.mock("../use-session-operations/useSessionOperations", () => ({
  useSessionOperations: () => ({ deleteSession: mockDeleteSession }),
}));

jest.mock("../use-localization/useLocalization", () => {
  const {
    mockMakeLoc,
  } = require("../../test-utils/mock-localization/mockLocalization");
  return { useLocalization: () => ({ loc: mockMakeLoc() }) };
});

jest.mock("@/utils", () => ({
  FeatureFlag: { session: "session" },
  logError: jest.fn(),
}));

const folder = {
  id: "f1",
  name: "AQUA",
  createdAt: new Date(1000),
  sessionCount: 2,
};

const setup = (target = folder) => {
  const showToast = jest.fn();
  const hideToast = jest.fn();
  const hook = renderHook(() => useFolderActions({ showToast, hideToast }));
  act(() => hook.result.current.onFolderMorePress(target));
  return { ...hook, showToast, hideToast };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSessions = [
    { id: "s1", folderId: "f1", lastModified: new Date(5000) },
    { id: "s2", folderId: "f1", lastModified: new Date(3000) },
    { id: "s3", folderId: "other", lastModified: new Date(9000) },
  ];
});

describe("useFolderActions", () => {
  it("opens the sheet with the latest session modification", () => {
    const { result } = setup();
    expect(result.current.actionsSheet.visible).toBe(true);
    expect(result.current.target?.folder).toBe(folder);
    expect(result.current.target?.modifiedAt).toEqual(new Date(5000));
  });

  it("falls back to createdAt for an empty folder", () => {
    mockSessions = [];
    const { result } = setup();
    expect(result.current.target?.modifiedAt).toEqual(new Date(1000));
  });

  it("dismisses the sheet", () => {
    const { result } = setup();
    act(() => result.current.actionsSheet.onDismiss());
    expect(result.current.actionsSheet.visible).toBe(false);
  });

  it("renames via the rename modal", async () => {
    const { result } = setup();
    act(() => result.current.actionsSheet.onRename());
    expect(result.current.actionsSheet.visible).toBe(false);
    expect(result.current.rename.visible).toBe(true);
    await act(() => result.current.rename.onSubmit("JAN3"));
    expect(mockRenameFolder).toHaveBeenCalledWith("f1", "JAN3");
    expect(result.current.rename.visible).toBe(false);
  });

  it("logs a failed rename and closes the modal", async () => {
    const { logError } = require("@/utils");
    mockRenameFolder.mockRejectedValueOnce(new Error("db"));
    const { result } = setup();
    act(() => result.current.actionsSheet.onRename());
    await act(() => result.current.rename.onSubmit("JAN3"));
    expect(logError).toHaveBeenCalled();
    expect(result.current.rename.visible).toBe(false);
  });

  it("cancels the rename modal", () => {
    const { result } = setup();
    act(() => result.current.actionsSheet.onRename());
    act(() => result.current.rename.onCancel());
    expect(result.current.rename.visible).toBe(false);
  });

  it("confirms with the session count, then deletes sessions and folder", async () => {
    const { result, showToast, hideToast } = setup();
    act(() => result.current.actionsSheet.onDelete());
    const toast = showToast.mock.calls[0][0];
    expect(toast.title).toBe("folderDeleteWithSessionsTitle_2");

    await act(() => toast.onPrimaryButtonTap());
    expect(hideToast).toHaveBeenCalled();
    expect(mockDeleteSession.mock.calls).toEqual([["s1"], ["s2"]]);
    expect(mockDeleteFolder).toHaveBeenCalledWith("f1");
    expect(String(mockShowGlobalTooltip.mock.calls[0][0])).toBe(
      "folderDeleted",
    );
  });

  it("uses the plain title for an empty folder", () => {
    mockSessions = [];
    const { result, showToast } = setup({ ...folder, sessionCount: 0 });
    act(() => result.current.actionsSheet.onDelete());
    expect(String(showToast.mock.calls[0][0].title)).toBe(
      "homeDeleteSelectedSessionsTitle",
    );
  });

  it("keeps the folder when a session delete fails", async () => {
    const { logError } = require("@/utils");
    mockDeleteSession.mockRejectedValueOnce(new Error("db"));
    const { result, showToast } = setup();
    act(() => result.current.actionsSheet.onDelete());
    await act(() => showToast.mock.calls[0][0].onPrimaryButtonTap());
    expect(mockDeleteFolder).not.toHaveBeenCalled();
    expect(mockShowGlobalTooltip).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalled();
  });
});
