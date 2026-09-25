/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import React from "react";

import Record from "./record";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
}));

const mockFinishOnboarding = jest.fn();
const mockConfirmSkip = jest.fn();
const mockEnsureMic = jest.fn(async () => true);
jest.mock("@/hooks", () => ({
  useLocalization: () => ({
    loc: new Proxy(
      {},
      {
        get: (_t, key) =>
          key === "shareFailed" ? (e: string) => `share:${e}` : String(key),
      },
    ),
  }),
  useMicPermission: () => mockEnsureMic,
  useOnboardingExit: () => ({
    finishOnboarding: mockFinishOnboarding,
    confirmSkip: mockConfirmSkip,
  }),
}));

const mockLogError = jest.fn();
jest.mock("@/utils", () => ({
  ...jest.requireActual("@/utils"),
  logError: (...args: unknown[]) => mockLogError(...args),
}));

const mockShare = jest.fn(async (_t: unknown) => {});
jest.mock("@/services", () => ({
  shareService: { shareTranscriptions: (t: unknown) => mockShare(t) },
}));

const transcription = {
  id: "t1",
  sessionId: "inc",
  text: "Hello",
  timestamp: new Date(),
  audioPath: "",
};

const mockCreateSession = jest.fn(async () => "inc");
const mockStartRecording = jest.fn(async () => true);
const mockStop = jest.fn(async () => {});
const mockDeleteTranscriptions = jest.fn(async () => {});
const mockDeleteAll = jest.fn(async () => {});
const mockUpdate = jest.fn(async () => {});
const mockClearIncognito = jest.fn(async () => {});
const mockMarkSeen = jest.fn(async () => {});
const mockTooltip = jest.fn();
const mockShowToast = jest.fn();
let mockTranscriptions: (typeof transcription)[] = [];
const mockUseSessionTranscriptions = jest.fn((_id: string) => mockTranscriptions);
jest.mock("@/stores", () => {
  const transcriptionState = () => ({
    stopRecordingAndSave: mockStop,
    deleteAllTranscriptionsForSession: mockDeleteAll,
    updateTranscription: mockUpdate,
  });
  const useTranscriptionStore = (sel: (s: unknown) => unknown) =>
    sel(transcriptionState());
  useTranscriptionStore.getState = transcriptionState;
  return {
    useCreateSession: () => mockCreateSession,
    useDeleteTranscriptions: () => mockDeleteTranscriptions,
    useIsEngineInitializing: () => false,
    useLivePreview: () => null,
    useMarkKeyboardPromptSeen: () => mockMarkSeen,
    useSessionStore: {
      getState: () => ({
        incognitoSession: { id: "inc" },
        clearIncognitoSession: mockClearIncognito,
      }),
    },
    useSessionTranscriptions: (id: string) => mockUseSessionTranscriptions(id),
    useShowGlobalTooltip: () => mockTooltip,
    useShowToast: () => mockShowToast,
    useStartRecording: () => mockStartRecording,
    useStopRecordingAndSave: () => mockStop,
    useTranscriptionState: () => "ready",
    useTranscriptionStore,
  };
});

jest.mock("@/components", () => {
  const { TouchableOpacity, View } = require("react-native");
  const keys = [
    "onBack",
    "onSkip",
    "onNext",
    "onRecordingStart",
    "onDelete",
    "onCopy",
    "onShare",
  ];
  return {
    RecordScreen: (props: Record<string, any>) => (
      <View>
        {keys.map((k) => (
          <TouchableOpacity key={k} testID={k} onPress={props[k]} />
        ))}
        <TouchableOpacity
          testID="onTranscriptionUpdate"
          onPress={() => props.onTranscriptionUpdate(props.transcriptions[0])}
        />
      </View>
    ),
    Toast: () => null,
  };
});

const renderRecord = async () => {
  const utils = render(<Record />);
  await act(async () => {});
  return utils;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockTranscriptions = [];
});

describe("Record onboarding route", () => {
  it("creates an incognito session and tears it down on unmount", async () => {
    const { unmount } = await renderRecord();
    await waitFor(() =>
      expect(mockUseSessionTranscriptions).toHaveBeenLastCalledWith("inc"),
    );
    expect(mockUseSessionTranscriptions).toHaveBeenCalledWith("");
    expect(mockCreateSession).toHaveBeenCalledWith(undefined, true);
    expect(mockMarkSeen).toHaveBeenCalled();
    unmount();
    await waitFor(() => expect(mockClearIncognito).toHaveBeenCalled());
    expect(mockStop).toHaveBeenCalled();
    expect(mockDeleteAll).toHaveBeenCalledWith("inc");
  });

  it("starts recording once the mic is allowed, else stays idle", async () => {
    const { getByTestId } = await renderRecord();
    await act(async () => fireEvent.press(getByTestId("onRecordingStart")));
    expect(mockStartRecording).toHaveBeenCalledTimes(1);

    mockStartRecording.mockResolvedValueOnce(false);
    await act(async () => fireEvent.press(getByTestId("onRecordingStart")));
    expect(mockTooltip).toHaveBeenCalledWith(
      "homeFailedStartRecording",
      "normal",
      undefined,
      true,
    );

    mockEnsureMic.mockResolvedValueOnce(false);
    await act(async () => fireEvent.press(getByTestId("onRecordingStart")));
    expect(mockStartRecording).toHaveBeenCalledTimes(2);
  });

  it("deletes, copies, shares and updates the transcript", async () => {
    mockTranscriptions = [transcription];
    const { getByTestId } = await renderRecord();
    await act(async () => fireEvent.press(getByTestId("onDelete")));
    expect(mockDeleteTranscriptions).toHaveBeenCalledWith(new Set(["t1"]));

    await act(async () => fireEvent.press(getByTestId("onCopy")));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith("Hello");

    await act(async () => fireEvent.press(getByTestId("onShare")));
    expect(mockShare).toHaveBeenCalledWith([transcription]);

    await act(async () =>
      fireEvent.press(getByTestId("onTranscriptionUpdate")),
    );
    expect(mockUpdate).toHaveBeenCalledWith(transcription);
  });

  it("reports copy and share failures", async () => {
    mockTranscriptions = [transcription];
    (Clipboard.setStringAsync as jest.Mock).mockRejectedValueOnce(
      new Error("nope"),
    );
    mockShare.mockRejectedValueOnce(new Error("sheet"));
    mockUpdate.mockRejectedValueOnce(new Error("db"));
    mockDeleteTranscriptions.mockRejectedValueOnce(new Error("db"));
    const { getByTestId } = await renderRecord();
    await act(async () => fireEvent.press(getByTestId("onCopy")));
    await act(async () => fireEvent.press(getByTestId("onShare")));
    await act(async () =>
      fireEvent.press(getByTestId("onTranscriptionUpdate")),
    );
    await act(async () => fireEvent.press(getByTestId("onDelete")));
    expect(mockShowToast).toHaveBeenCalledWith("share:sheet", "error");
    const messages = mockLogError.mock.calls.map(([, ctx]) => ctx.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        "Failed to copy onboarding transcription",
        "Failed to share onboarding transcription",
        "Failed to update onboarding transcription",
        "Failed to delete onboarding transcription",
      ]),
    );
  });

  it("clears the incognito session even when teardown fails", async () => {
    mockStop.mockRejectedValueOnce(new Error("stop"));
    const { unmount } = await renderRecord();
    unmount();
    await waitFor(() => expect(mockClearIncognito).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockLogError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          message: "Failed to set up or tear down onboarding session",
        }),
      ),
    );
    expect(mockDeleteAll).not.toHaveBeenCalled();
  });

  it("wires back, skip and next", async () => {
    const { getByTestId } = await renderRecord();
    fireEvent.press(getByTestId("onBack"));
    fireEvent.press(getByTestId("onSkip"));
    fireEvent.press(getByTestId("onNext"));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockConfirmSkip).toHaveBeenCalledTimes(1);
    expect(mockFinishOnboarding).toHaveBeenCalledTimes(1);
  });
});
