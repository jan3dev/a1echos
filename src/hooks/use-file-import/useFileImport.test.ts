/* eslint-disable @typescript-eslint/no-require-imports */
import { renderHook } from "@testing-library/react-native";
import * as DocumentPicker from "expo-document-picker";
import { useNavigationContainerRef, useRouter } from "expo-router";
import { Platform } from "react-native";

import { Routes } from "@/constants";
import { TranscriptionState } from "@/models";

import { useFileImport } from "./useFileImport";

const mockCreateSession = jest.fn(async (..._args: unknown[]) => "new-session");
const mockImportFiles = jest.fn(async (..._args: unknown[]) => ({
  imported: 1,
  failed: [] as { name: string; reason: string }[],
}));
const mockDeleteSession = jest.fn(async (_id: string) => undefined);
const mockShowGlobalTooltip = jest.fn();
let mockState = "ready";

jest.mock("@/stores", () => ({
  AUDIO_BUSY_STATES: new Set(["recording"]),
  useCreateSession: () => mockCreateSession,
  useImportFiles: () => mockImportFiles,
  useShowGlobalTooltip: () => mockShowGlobalTooltip,
  useTranscriptionStore: { getState: () => ({ state: mockState }) },
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
  getErrorMessage: (e: Error) => e.message,
}));

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
  useNavigationContainerRef: jest.fn(),
}));

const pick = DocumentPicker.getDocumentAsync as jest.Mock;
const asset = (name: string) => ({ uri: `/cache/${name}`, name });
const mockPush = jest.fn();
const mockBack = jest.fn();
const showAlertToast = jest.fn();
let currentRoute: { params?: { id?: string } } | undefined;

const run = async (folderId?: string, sessionId?: string) => {
  const { result } = renderHook(() =>
    useFileImport({ showAlertToast, folderId, sessionId }),
  );
  await result.current();
};

beforeEach(() => {
  mockState = TranscriptionState.READY;
  currentRoute = { params: { id: "new-session" } };
  (useRouter as jest.Mock).mockReturnValue({ push: mockPush, back: mockBack });
  (useNavigationContainerRef as jest.Mock).mockReturnValue({
    getCurrentRoute: () => currentRoute,
  });
});

it("does nothing when the picker is cancelled", async () => {
  pick.mockResolvedValueOnce({ canceled: true, assets: null });
  await run();
  expect(mockCreateSession).not.toHaveBeenCalled();
});

it("opens the picker for audio and markdown, multi-select", async () => {
  pick.mockResolvedValueOnce({ canceled: true, assets: null });
  await run();
  expect(pick).toHaveBeenCalledWith(
    expect.objectContaining({
      type: ["audio/*", "text/plain", "text/markdown", "text/x-markdown"],
      multiple: true,
      copyToCacheDirectory: true,
    }),
  );
});

it("limits the Android picker to decodable audio types", async () => {
  const os = Platform.OS;
  Platform.OS = "android";
  pick.mockResolvedValueOnce({ canceled: true, assets: null });
  await run();
  Platform.OS = os;
  const { type } = pick.mock.calls[0][0];
  expect(type).toEqual(
    expect.arrayContaining(["audio/mp4", "audio/ogg", "text/plain"]),
  );
  expect(type).not.toContain("audio/*");
  expect(type).not.toContain("audio/x-aiff");
});

it("names the session after a single file, navigates, then imports", async () => {
  const files = [asset("Team Sync.mp3")];
  pick.mockResolvedValueOnce({ canceled: false, assets: files });

  await run("folder-1");

  const [name, incognito, prefix, , folder] = mockCreateSession.mock.calls[0];
  expect([name, incognito, String(prefix), folder]).toEqual([
    "Team Sync",
    false,
    "recordingPrefix",
    "folder-1",
  ]);
  expect(mockPush).toHaveBeenCalledWith(Routes.session("new-session"));
  expect(mockImportFiles).toHaveBeenCalledWith("new-session", files);
  expect(mockDeleteSession).not.toHaveBeenCalled();
  expect(showAlertToast).not.toHaveBeenCalled();
});

it("keeps the session on partial failure and lists the reason", async () => {
  pick.mockResolvedValueOnce({
    canceled: false,
    assets: [asset("a.mp3"), asset("b.md")],
  });
  mockImportFiles.mockResolvedValueOnce({
    imported: 1,
    failed: [{ name: "a.mp3", reason: "tooLong" }],
  });

  await run();

  expect(mockCreateSession.mock.calls[0][0]).toBeUndefined();
  expect(mockDeleteSession).not.toHaveBeenCalled();
  expect(showAlertToast).toHaveBeenCalledWith({
    title: "uploadFailed_1",
    message: "a.mp3: uploadErrorTooLong",
    messageMaxLines: 1,
    variant: "error",
  });
});

it("goes back and deletes the session when every file fails", async () => {
  pick.mockResolvedValueOnce({
    canceled: false,
    assets: [asset("s.mp3"), asset("e.md"), asset("x.pdf")],
  });
  mockImportFiles.mockResolvedValueOnce({
    imported: 0,
    failed: [
      { name: "s.mp3", reason: "noSpeech" },
      { name: "e.md", reason: "empty" },
      { name: "x.pdf", reason: "unsupported" },
    ],
  });

  await run();

  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(mockDeleteSession).toHaveBeenCalledWith("new-session");
  expect(showAlertToast).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "uploadFailed_3",
      message:
        "s.mp3: uploadErrorNoSpeech\ne.md: uploadErrorEmpty\nx.pdf: uploadErrorUnsupported",
      messageMaxLines: 3,
    }),
  );
});

it("maps the remaining reasons", async () => {
  pick.mockResolvedValueOnce({
    canceled: false,
    assets: [asset("a.md"), asset("b.mp3")],
  });
  mockImportFiles.mockResolvedValueOnce({
    imported: 0,
    failed: [
      { name: "a.md", reason: "tooLarge" },
      { name: "b.mp3", reason: "failed" },
    ],
  });
  await run();
  expect(showAlertToast.mock.calls[0][0].message).toBe(
    "a.md: uploadErrorTooLarge\nb.mp3: uploadErrorFailed",
  );
});

it("deletes without navigating when the user already left the session", async () => {
  currentRoute = { params: { id: "other" } };
  pick.mockResolvedValueOnce({ canceled: false, assets: [asset("e.md")] });
  mockImportFiles.mockResolvedValueOnce({
    imported: 0,
    failed: [{ name: "e.md", reason: "empty" }],
  });

  await run();

  expect(mockBack).not.toHaveBeenCalled();
  expect(mockDeleteSession).toHaveBeenCalledWith("new-session");
});

it("handles a missing current route", async () => {
  currentRoute = undefined;
  pick.mockResolvedValueOnce({ canceled: false, assets: [asset("e.md")] });
  mockImportFiles.mockResolvedValueOnce({
    imported: 0,
    failed: [{ name: "e.md", reason: "empty" }],
  });
  await run();
  expect(mockBack).not.toHaveBeenCalled();
  expect(mockDeleteSession).toHaveBeenCalled();
});

it("refuses while a recording is in progress", async () => {
  mockState = "recording";
  pick.mockResolvedValueOnce({ canceled: false, assets: [asset("a.mp3")] });

  await run();

  expect(mockCreateSession).not.toHaveBeenCalled();
  expect(String(mockShowGlobalTooltip.mock.calls[0][0])).toBe("uploadBusy");
});

it("deletes the picked copies when refusing while busy", async () => {
  const { File } = jest.requireMock("expo-file-system");
  const del = jest.fn();
  (File as jest.Mock).mockImplementationOnce(() => ({ delete: del }));
  mockState = "recording";
  pick.mockResolvedValueOnce({ canceled: false, assets: [asset("a.mp3")] });
  await run();
  expect(File).toHaveBeenCalledWith("/cache/a.mp3");
  expect(del).toHaveBeenCalled();
});

it("deletes the session when the import itself throws", async () => {
  pick.mockResolvedValueOnce({ canceled: false, assets: [asset("a.mp3")] });
  mockImportFiles.mockRejectedValueOnce(
    new Error("Cannot import while recording"),
  );
  await run();
  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(mockDeleteSession).toHaveBeenCalledWith("new-session");
  expect(showAlertToast).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Cannot import while recording" }),
  );
});

it("surfaces unexpected errors in the toast", async () => {
  pick.mockRejectedValueOnce(new Error("picker broke"));
  await run();
  expect(require("@/utils").logError).toHaveBeenCalled();
  expect(showAlertToast).toHaveBeenCalledWith({
    title: "uploadFailed_1",
    message: "picker broke",
    variant: "error",
  });
});

it("imports into an existing session without creating, navigating or deleting it", async () => {
  const files = [asset("a.mp3")];
  pick.mockResolvedValueOnce({ canceled: false, assets: files });
  mockImportFiles.mockResolvedValueOnce({
    imported: 0,
    failed: [{ name: "a.mp3", reason: "noSpeech" }],
  });

  await run(undefined, "existing");

  expect(mockCreateSession).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockImportFiles).toHaveBeenCalledWith("existing", files);
  expect(mockDeleteSession).not.toHaveBeenCalled();
  expect(mockBack).not.toHaveBeenCalled();
  expect(showAlertToast).toHaveBeenCalled();
});
