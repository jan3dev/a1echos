/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import React from "react";

import { Routes, TestID } from "@/constants";
import { audioProtectionService, shareService } from "@/services";

import TranscriptionEditScreen from "./index";

const mockBack = jest.fn();
const mockPush = jest.fn();
let mockParams: Record<string, string> = { id: "t1" };
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

const {
  mockMakeLoc,
} = require("../../../../src/test-utils/mock-localization/mockLocalization");

jest.mock("@/hooks", () => ({
  useKeyboardHeight: jest.fn(() => 0),
  useScrollSurface: jest.fn(() => ({ scrolled: false, onScroll: jest.fn() })),
  useLocalization: jest.fn(() => ({ loc: mockMakeLoc() })),
}));

jest.mock("@/utils", () => ({
  FeatureFlag: { transcription: "TRANSCRIPTION", storage: "STORAGE" },
  logError: jest.fn(),
}));

const mockRelease = jest.fn(async () => undefined);
jest.mock("@/services", () => ({
  audioProtectionService: {
    audioExists: jest.fn((path: string) => path !== ""),
    openPlaintextAudio: jest.fn(async () => ({
      path: "/cache/dec_t1.wav",
      release: mockRelease,
    })),
    deleteAudio: jest.fn(async () => undefined),
  },
  shareService: { shareTranscriptions: jest.fn(async () => undefined) },
}));

const baseItem = {
  id: "t1",
  sessionId: "s1",
  text: "Hello world",
  timestamp: new Date("2026-04-18T07:18:00"),
  audioPath: "/audio/t1.wav",
};
let mockTranscriptions: any[] = [];
const mockUpdate = jest.fn(async (..._args: any[]) => undefined);
const mockDelete = jest.fn(async (..._args: any[]) => undefined);
const mockDeleteAudio = jest.fn(async (..._args: any[]) => undefined);
const mockReprocess = jest.fn(async (..._args: any[]) => "Hola mundo");
const mockTooltip = jest.fn();
jest.mock("@/stores", () => ({
  useTranscriptionStore: (selector: any) =>
    selector({ transcriptions: mockTranscriptions }),
  useSelectedLanguage: () => ({ code: "en", name: "English" }),
  useTextAppearance: () => ({ fontSize: "medium" }),
  useUpdateTranscription: () => mockUpdate,
  useDeleteTranscription: () => mockDelete,
  useDeleteTranscriptionAudio: () => mockDeleteAudio,
  useReprocessTranscription: () => mockReprocess,
  useShowGlobalTooltip: () => mockTooltip,
}));

jest.mock("@/models", () => ({
  transcriptTextStyle: () => ({}),
}));

const mockShowToast = jest.fn();
let mockPlayerUri: string | null = null;
jest.mock("@/components", () => {
  const { Pressable, Text, View } = require("react-native");
  const { TestID: TID } = require("@/constants");
  const Pass = ({ children }: any) => <View>{children}</View>;
  return {
    AppBarBlurTarget: Pass,
    Screen: Pass,
    AudioPlayer: (props: any) => {
      mockPlayerUri = props.uri;
      return (
        <Pressable
          testID={TID.TranscriptionEditAudio}
          onPress={props.onDelete}
        />
      );
    },
    Button: {
      primary: (props: any) => (
        <Pressable
          testID={props.testID}
          disabled={!props.enabled}
          onPress={props.onPress}
        />
      ),
    },
    Icon: () => null,
    ListItem: (props: any) => (
      <Pressable testID={props.testID} onPress={props.onPress}>
        <Text>{props.titleTrailing}</Text>
      </Pressable>
    ),
    ProgressIndicator: () => <View testID="progress" />,
    SubScreenNavbarActions: ({ actions }: any) =>
      actions.map((a: any) => (
        <Pressable key={a.key} testID={`action-${a.key}`} onPress={a.onPress} />
      )),
    Toast: () => null,
    TopAppBar: ({ actions }: any) => <View>{actions}</View>,
    TranscriptionTimestamp: () => null,
    useToast: () => ({
      show: mockShowToast,
      hide: jest.fn(),
      toastState: {},
    }),
  };
});

const confirmToast = async () => {
  await act(async () => {
    mockShowToast.mock.calls.at(-1)[0].onPrimaryButtonTap();
  });
};

const renderScreen = async () => {
  const utils = render(<TranscriptionEditScreen />);
  await act(async () => {});
  return utils;
};

describe("TranscriptionEditScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { id: "t1" };
    mockTranscriptions = [baseItem];
    mockPlayerUri = null;
  });

  it("saves the trimmed edited text and closes", async () => {
    const { getByTestId } = await renderScreen();
    const save = getByTestId(TestID.TranscriptionEditSave);
    expect(save.props.accessibilityState?.disabled ?? save.props.disabled).toBe(
      true,
    );

    fireEvent.changeText(getByTestId(TestID.TranscriptionEditInput), " Hi ");
    await act(async () => {
      fireEvent.press(getByTestId(TestID.TranscriptionEditSave));
    });

    expect(mockUpdate).toHaveBeenCalledWith({ ...baseItem, text: "Hi" });
    expect(mockBack).toHaveBeenCalled();
  });

  it("stays open when saving fails", async () => {
    mockUpdate.mockRejectedValueOnce(new Error("db"));
    const { getByTestId } = await renderScreen();

    fireEvent.changeText(getByTestId(TestID.TranscriptionEditInput), "Hi");
    await act(async () => {
      fireEvent.press(getByTestId(TestID.TranscriptionEditSave));
    });

    expect(mockBack).not.toHaveBeenCalled();
  });

  it("plays the plaintext audio and releases it on unmount", async () => {
    const { unmount } = await renderScreen();
    expect(mockPlayerUri).toBe("file:///cache/dec_t1.wav");

    unmount();

    expect(mockRelease).toHaveBeenCalled();
  });

  it("hides audio, language and reprocess without audio", async () => {
    mockTranscriptions = [{ ...baseItem, audioPath: "" }];
    const { queryByTestId } = await renderScreen();

    expect(queryByTestId(TestID.TranscriptionEditAudio)).toBeNull();
    expect(queryByTestId(TestID.TranscriptionEditLanguage)).toBeNull();
    expect(queryByTestId(TestID.TranscriptionEditReprocess)).toBeNull();
    expect(audioProtectionService.openPlaintextAudio).not.toHaveBeenCalled();
  });

  it("hides audio rows when the audio file is missing", async () => {
    (audioProtectionService.audioExists as jest.Mock).mockReturnValueOnce(
      false,
    );
    const { queryByTestId } = await renderScreen();

    expect(queryByTestId(TestID.TranscriptionEditAudio)).toBeNull();
    expect(queryByTestId(TestID.TranscriptionEditReprocess)).toBeNull();
  });

  it("opens the language picker with the current language", async () => {
    mockParams = { id: "t1", language: "es" };
    const { getByTestId, getByText } = await renderScreen();
    expect(getByText("ES")).toBeTruthy();

    fireEvent.press(getByTestId(TestID.TranscriptionEditLanguage));

    expect(mockPush).toHaveBeenCalledWith(
      Routes.transcriptionLanguage("t1", "es"),
    );
  });

  it("reprocesses in the chosen language into the editor", async () => {
    mockParams = { id: "t1", language: "es" };
    const { getByTestId } = await renderScreen();

    await act(async () => {
      fireEvent.press(getByTestId(TestID.TranscriptionEditReprocess));
    });

    expect(mockReprocess).toHaveBeenCalledWith("/audio/t1.wav", "es");
    expect(getByTestId(TestID.TranscriptionEditInput).props.value).toBe(
      "Hola mundo",
    );
  });

  it("reports a failed reprocess", async () => {
    mockReprocess.mockRejectedValueOnce(new Error("busy"));
    const { getByTestId } = await renderScreen();

    await act(async () => {
      fireEvent.press(getByTestId(TestID.TranscriptionEditReprocess));
    });

    expect(String(mockTooltip.mock.calls[0][0])).toBe("reprocessFailed");
  });

  it("deletes the audio after confirmation", async () => {
    const { getByTestId } = await renderScreen();

    fireEvent.press(getByTestId(TestID.TranscriptionEditAudio));
    await confirmToast();

    expect(mockDeleteAudio).toHaveBeenCalledWith("t1");
    expect(String(mockTooltip.mock.calls[0][0])).toBe("audioDeleted");
  });

  it("deletes the transcription after confirmation and closes", async () => {
    const { getByTestId } = await renderScreen();

    fireEvent.press(getByTestId("action-delete"));
    await confirmToast();

    expect(mockDelete).toHaveBeenCalledWith("t1");
    expect(mockBack).toHaveBeenCalled();
  });

  it("logs failed deletes without closing", async () => {
    mockDelete.mockRejectedValueOnce(new Error("db"));
    mockDeleteAudio.mockRejectedValueOnce(new Error("db"));
    const { getByTestId } = await renderScreen();

    fireEvent.press(getByTestId("action-delete"));
    await confirmToast();
    fireEvent.press(getByTestId(TestID.TranscriptionEditAudio));
    await confirmToast();

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockTooltip).not.toHaveBeenCalled();
  });

  it("copies and shares the current text", async () => {
    const { getByTestId } = await renderScreen();
    fireEvent.changeText(getByTestId(TestID.TranscriptionEditInput), "Edited");

    await act(async () => {
      fireEvent.press(getByTestId("action-copy"));
    });
    await act(async () => {
      fireEvent.press(getByTestId("action-share"));
    });

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith("Edited");
    expect(shareService.shareTranscriptions).toHaveBeenCalledWith([
      { ...baseItem, text: "Edited" },
    ]);
  });

  it("closes from the app bar", async () => {
    const { getByTestId } = await renderScreen();

    fireEvent.press(getByTestId(TestID.TranscriptionEditClose));

    expect(mockBack).toHaveBeenCalled();
  });

  it("renders nothing for an unknown transcription", async () => {
    mockTranscriptions = [];
    const { toJSON } = await renderScreen();

    expect(toJSON()).toBeNull();
  });
});
