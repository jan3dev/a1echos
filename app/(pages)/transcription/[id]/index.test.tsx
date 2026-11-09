/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import React from "react";
import { ScrollView, StyleSheet } from "react-native";

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
  shareService: {
    shareTranscriptions: jest.fn(async () => undefined),
    saveAudioWav: jest.fn(async () => true),
  },
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
const mockStructure = jest.fn(async (..._args: any[]): Promise<any> => ({
  outcome: "done",
  text: "Plans:\n- Hello world",
}));
const mockCancelLlm = jest.fn();
let mockLlmId: string | null = "qwen35_2b";
let mockSummarySessionId: string | null = null;
let mockIsStructuring = false;
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
  useStructureText: () => mockStructure,
  useCancelSummary: () => mockCancelLlm,
  useSelectedLlmId: () => mockLlmId,
  useSummarySessionId: () => mockSummarySessionId,
  useIsSummaryBlocked: () => false,
  useIsStructuring: () => mockIsStructuring,
  useSummaryStore: { getState: () => ({ isStructuring: mockIsStructuring }) },
}));

jest.mock("@/models", () => ({
  transcriptTextStyle: () => ({}),
  getLlmInfo: (id: string) => ({ englishOnly: id.endsWith("_en") }),
}));

const mockShowToast = jest.fn();
let mockPlayerUri: string | null = null;
let mockPlayerDownload: (() => Promise<void>) | undefined;
jest.mock("@/components", () => {
  const { Pressable, Text, View } = require("react-native");
  const { TestID: TID } = require("@/constants");
  const Pass = ({ children }: any) => <View>{children}</View>;
  return {
    AppBarBlurTarget: Pass,
    Screen: Pass,
    AudioPlayer: (props: any) => {
      mockPlayerUri = props.uri;
      mockPlayerDownload = props.onDownload;
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
    PRIMARY_BUTTON_HEIGHT: 56,
    SUB_SCREEN_NAVBAR_HEIGHT: 72,
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
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    require("@/hooks").useKeyboardHeight.mockReturnValue(0);
    mockParams = { id: "t1" };
    mockTranscriptions = [baseItem];
    mockPlayerUri = null;
    mockLlmId = "qwen35_2b";
    mockSummarySessionId = null;
    mockIsStructuring = false;
  });

  const pressStructure = async (getByTestId: (id: string) => any) => {
    await act(async () => {
      fireEvent.press(getByTestId(TestID.TranscriptionEditStructure));
    });
  };

  it("structures the current text into the editor, even without audio", async () => {
    mockTranscriptions = [{ ...baseItem, audioPath: "" }];
    const { getByTestId } = await renderScreen();
    fireEvent.changeText(getByTestId(TestID.TranscriptionEditInput), " Hi ");

    await pressStructure(getByTestId);

    expect(mockStructure).toHaveBeenCalledWith("Hi");
    expect(getByTestId(TestID.TranscriptionEditInput).props.value).toBe(
      "Plans:\n- Hello world",
    );
    expect(mockTooltip).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("warns when an English-only model structures another language", async () => {
    mockLlmId = "qwen35_0_8b_en";
    mockParams = { id: "t1", language: "es" };
    const { getByTestId } = await renderScreen();

    await pressStructure(getByTestId);

    expect(String(mockTooltip.mock.calls[0][0])).toBe("llmEnglishOnlyWarning");
  });

  it.each([
    [{ outcome: "no-model" }, "structureNeedsModel"],
    [{ outcome: "cancelled" }, "structureStopped"],
    [{ outcome: "stopped" }, undefined],
  ])("reports %o", async (result, tooltip) => {
    mockStructure.mockResolvedValueOnce(result);
    const { getByTestId } = await renderScreen();

    await pressStructure(getByTestId);

    expect(mockTooltip.mock.calls[0]?.[0]?.toString()).toBe(tooltip);
    expect(getByTestId(TestID.TranscriptionEditInput).props.value).toBe(
      "Hello world",
    );
    if (result.outcome === "no-model") {
      expect(mockPush).toHaveBeenCalledWith(Routes.settingsIntelligence);
    }
  });

  it("reports a failed structuring", async () => {
    mockStructure.mockRejectedValueOnce(new Error("oom"));
    const { getByTestId } = await renderScreen();

    await pressStructure(getByTestId);

    expect(String(mockTooltip.mock.calls[0][0])).toBe("structureFailed");
  });

  it.each([
    ["a summary runs", () => (mockSummarySessionId = "s1"), "Hello world"],
    ["the text is empty", () => {}, "  "],
  ])("can't structure while %s", async (_why, setup, text) => {
    setup();
    const { getByTestId } = await renderScreen();
    fireEvent.changeText(getByTestId(TestID.TranscriptionEditInput), text);

    await pressStructure(getByTestId);

    expect(mockStructure).not.toHaveBeenCalled();
  });

  it("locks editing while structuring and stops it on leaving", async () => {
    mockIsStructuring = true;
    const { getByTestId, unmount } = await renderScreen();

    await pressStructure(getByTestId);

    expect(mockStructure).not.toHaveBeenCalled();
    expect(getByTestId(TestID.TranscriptionEditInput).props.editable).toBe(
      false,
    );
    await act(async () => {
      fireEvent.press(getByTestId(TestID.TranscriptionEditReprocess));
    });
    expect(mockReprocess).not.toHaveBeenCalled();

    unmount();
    expect(mockCancelLlm).toHaveBeenCalled();
  });

  it("leaves the model alone when leaving while idle", async () => {
    const { unmount } = await renderScreen();
    unmount();
    expect(mockCancelLlm).not.toHaveBeenCalled();
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

  describe("audio download", () => {
    const saveAudioWav = () => shareService.saveAudioWav as jest.Mock;
    const download = () =>
      act(async () => {
        await mockPlayerDownload!();
      });

    it("saves the plaintext recording and confirms", async () => {
      await renderScreen();

      await download();

      expect(saveAudioWav()).toHaveBeenCalledWith(
        "file:///cache/dec_t1.wav",
        baseItem.timestamp,
        expect.any(Function),
      );
      expect(mockTooltip).toHaveBeenCalledTimes(1);
      expect(String(mockTooltip.mock.calls[0][0])).toBe("audioDownloaded");
      expect(mockTooltip.mock.calls[0].slice(1)).toEqual(["success", 3000]);
    });

    it("shows nothing when the picker is cancelled", async () => {
      saveAudioWav().mockResolvedValueOnce(false);
      await renderScreen();

      await download();

      expect(mockTooltip).not.toHaveBeenCalled();
    });

    it("shows Downloading… only for slow writes", async () => {
      jest.useFakeTimers();
      let finish!: (saved: boolean) => void;
      saveAudioWav().mockImplementationOnce(
        async (_uri: string, _at: Date, onWriteStart: () => void) => {
          onWriteStart();
          return new Promise<boolean>((resolve) => (finish = resolve));
        },
      );
      await renderScreen();

      let pending!: Promise<void>;
      act(() => {
        pending = mockPlayerDownload!();
      });
      act(() => jest.advanceTimersByTime(1000));
      expect(String(mockTooltip.mock.calls[0][0])).toBe("downloading");
      expect(mockTooltip.mock.calls[0][1]).toBe("brand");

      await act(async () => {
        finish(true);
        await pending;
      });
      expect(String(mockTooltip.mock.calls[1][0])).toBe("audioDownloaded");
    });

    it("skips Downloading… for fast writes", async () => {
      jest.useFakeTimers();
      saveAudioWav().mockImplementationOnce(
        async (_uri: string, _at: Date, onWriteStart: () => void) => {
          onWriteStart();
          return true;
        },
      );
      await renderScreen();

      await download();
      act(() => jest.advanceTimersByTime(1000));

      expect(mockTooltip).toHaveBeenCalledTimes(1);
      expect(String(mockTooltip.mock.calls[0][0])).toBe("audioDownloaded");
    });

    it("warns on failure and allows a retry", async () => {
      saveAudioWav().mockRejectedValueOnce(new Error("disk full"));
      await renderScreen();

      await download();
      expect(String(mockTooltip.mock.calls[0][0])).toBe("downloadFailed");
      expect(mockTooltip.mock.calls[0][1]).toBe("warning");

      await download();
      expect(saveAudioWav()).toHaveBeenCalledTimes(2);
    });

    it("ignores taps while a download is running", async () => {
      saveAudioWav().mockImplementationOnce(() => new Promise(() => {}));
      await renderScreen();

      act(() => {
        mockPlayerDownload!();
      });
      await download();

      expect(saveAudioWav()).toHaveBeenCalledTimes(1);
    });
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

  it("floats Save above the keyboard and hides the actions", async () => {
    require("@/hooks").useKeyboardHeight.mockReturnValue(300);
    const { getAllByTestId, queryByTestId } = await renderScreen();

    expect(getAllByTestId(TestID.TranscriptionEditSave)).toHaveLength(1);
    expect(
      getAllByTestId(TestID.TranscriptionEditSave, {
        includeHiddenElements: true,
      }),
    ).toHaveLength(2);
    expect(queryByTestId("action-copy")).toBeNull();
  });

  it("steps the Save bar aside once the in-page Save is in view", async () => {
    require("@/hooks").useKeyboardHeight.mockReturnValue(300);
    const { getByTestId, UNSAFE_getByType } = await renderScreen();
    const barOffset = () =>
      StyleSheet.flatten(
        getByTestId(TestID.TranscriptionEditSaveBar, {
          includeHiddenElements: true,
        }).props.style,
      ).transform[0].translateY;

    expect(barOffset()).toBe(0);
    fireEvent(UNSAFE_getByType(ScrollView), "layout", {
      nativeEvent: { layout: { height: 10000 } },
    });
    expect(barOffset()).toBeGreaterThan(0);
  });

  it("keeps Save in-page above the landscape keyboard", async () => {
    require("@/hooks").useKeyboardHeight.mockReturnValue(200);
    jest
      .spyOn(require("react-native"), "useWindowDimensions")
      .mockReturnValue({ width: 844, height: 390, scale: 3, fontScale: 1 });
    const { getAllByTestId, queryByTestId } = await renderScreen();

    expect(getAllByTestId(TestID.TranscriptionEditSave)).toHaveLength(1);
    expect(queryByTestId("action-copy")).toBeNull();
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
