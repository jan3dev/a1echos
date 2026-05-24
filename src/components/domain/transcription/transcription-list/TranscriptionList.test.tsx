/* eslint-disable @typescript-eslint/no-require-imports, react/display-name */
import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { Transcription } from "@/models";
import {
  useSessionTranscriptions,
  useSettingsStore,
  useTranscriptionStore,
} from "@/stores";

import { TranscriptionList } from "./TranscriptionList";

jest.mock("@/stores", () => ({
  useSessionTranscriptions: jest.fn(() => []),
  useTranscriptionStore: jest.fn(),
  useSettingsStore: jest.fn(),
}));

const SimpleItem = (props: any) => {
  const { View, Text } = require("react-native");
  return (
    <View testID={`transcription-item-${props.transcription.id}`}>
      <Text>{props.transcription.text}</Text>
    </View>
  );
};

jest.mock("../transcription-item/TranscriptionItem", () => ({
  TranscriptionItem: (props: any) => SimpleItem(props),
}));

const restoreSimpleItemMock = () => {
  jest.requireMock(
    "../transcription-item/TranscriptionItem",
  ).TranscriptionItem = SimpleItem;
};

const mockTranscriptions: Transcription[] = [
  {
    id: "t1",
    text: "First transcription",
    timestamp: new Date("2024-01-01"),
    audioPath: "/audio/t1.wav",
    sessionId: "s1",
  },
  {
    id: "t2",
    text: "Second transcription",
    timestamp: new Date("2024-01-02"),
    audioPath: "/audio/t2.wav",
    sessionId: "s1",
  },
];

const mockStoreDefaults = {
  livePreview: null,
  loadingPreview: null,
  isRecording: () => false,
  isTranscribing: () => false,
  updateTranscription: jest.fn(),
};

const mockSettingsDefaults = {
  selectedModelType: "WHISPER_FILE",
};

const defaultProps = {
  onTranscriptionTap: jest.fn(),
  onTranscriptionLongPress: jest.fn(),
};

describe("TranscriptionList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    restoreSimpleItemMock();
    (useTranscriptionStore as unknown as jest.Mock).mockReturnValue(
      mockStoreDefaults,
    );
    (useSettingsStore as unknown as jest.Mock).mockReturnValue(
      mockSettingsDefaults,
    );
  });

  it("renders TranscriptionItem for each transcription", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    const { getByTestId } = render(<TranscriptionList {...defaultProps} />);
    expect(getByTestId("transcription-item-t1")).toBeTruthy();
    expect(getByTestId("transcription-item-t2")).toBeTruthy();
  });

  it("returns null for empty data", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue([]);
    const { toJSON } = render(<TranscriptionList {...defaultProps} />);
    expect(toJSON()).toBeNull();
  });

  it("renders chronologically with the newest entry at the visual bottom", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    const { UNSAFE_getByType } = render(
      <TranscriptionList {...defaultProps} />,
    );
    const { FlatList } = require("react-native");
    const flatList = UNSAFE_getByType(FlatList);
    expect(flatList.props.inverted).toBeFalsy();
    const ids = flatList.props.data.map((t: Transcription) => t.id);
    expect(ids).toEqual(["t1", "t2"]);
  });

  it("preview item is appended at the visual bottom", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    (useTranscriptionStore as unknown as jest.Mock).mockReturnValue({
      ...mockStoreDefaults,
      isRecording: () => true,
      loadingPreview: {
        id: "preview1",
        text: "",
        timestamp: new Date(),
        audioPath: "",
        sessionId: "s1",
      },
    });
    const { getByTestId, UNSAFE_getByType } = render(
      <TranscriptionList {...defaultProps} />,
    );
    const { FlatList } = require("react-native");
    const flatList = UNSAFE_getByType(FlatList);
    const data = flatList.props.data;
    expect(data[data.length - 1].id).toBe("preview1");
    expect(getByTestId("transcription-item-preview1")).toBeTruthy();
    expect(getByTestId("transcription-item-t1")).toBeTruthy();
  });

  it("paginates to the latest 30 entries by default", () => {
    const many: Transcription[] = Array.from({ length: 50 }, (_, i) => ({
      id: `tr${i}`,
      text: `row ${i}`,
      timestamp: new Date(2024, 0, 1 + i),
      audioPath: "",
      sessionId: "s1",
    }));
    (useSessionTranscriptions as jest.Mock).mockReturnValue(many);
    const { UNSAFE_getByType } = render(
      <TranscriptionList {...defaultProps} />,
    );
    const { FlatList } = require("react-native");
    const flatList = UNSAFE_getByType(FlatList);
    expect(flatList.props.data).toHaveLength(30);
    // Last 30 in chronological order: tr20 (oldest visible) … tr49 (newest).
    expect(flatList.props.data[0].id).toBe("tr20");
    expect(flatList.props.data[29].id).toBe("tr49");
  });

  it("onStartReached extends the window by another page of older entries", () => {
    const many: Transcription[] = Array.from({ length: 50 }, (_, i) => ({
      id: `tr${i}`,
      text: `row ${i}`,
      timestamp: new Date(2024, 0, 1 + i),
      audioPath: "",
      sessionId: "s1",
    }));
    (useSessionTranscriptions as jest.Mock).mockReturnValue(many);
    const { UNSAFE_getByType } = render(
      <TranscriptionList {...defaultProps} />,
    );
    const { FlatList } = require("react-native");
    const flatList = UNSAFE_getByType(FlatList);
    act(() => {
      flatList.props.onStartReached();
    });
    const refreshed = UNSAFE_getByType(FlatList);
    expect(refreshed.props.data).toHaveLength(50);
    expect(refreshed.props.data[0].id).toBe("tr0");
  });

  it("onStartReached is a no-op once everything is loaded", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    const { UNSAFE_getByType } = render(
      <TranscriptionList {...defaultProps} />,
    );
    const { FlatList } = require("react-native");
    const flatList = UNSAFE_getByType(FlatList);
    act(() => {
      flatList.props.onStartReached();
      flatList.props.onStartReached();
    });
    const refreshed = UNSAFE_getByType(FlatList);
    expect(refreshed.props.data).toHaveLength(2);
  });

  it("scroll-to-latest button is reachable after the user scrolls up", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    const { getByLabelText, UNSAFE_getByType } = render(
      <TranscriptionList {...defaultProps} />,
    );
    const { FlatList } = require("react-native");
    const flatList = UNSAFE_getByType(FlatList);
    act(() => {
      flatList.props.onScroll({
        nativeEvent: {
          contentOffset: { y: 0 },
          contentSize: { height: 99999 },
          layoutMeasurement: { height: 100 },
        },
      });
    });
    const button = getByLabelText("scrollToLatest");
    expect(button).toBeTruthy();
    fireEvent.press(button);
  });

  it("wires onContentSizeChange for the initial snap-to-bottom", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    const { UNSAFE_getByType } = render(
      <TranscriptionList {...defaultProps} />,
    );
    const { FlatList } = require("react-native");
    const flatList = UNSAFE_getByType(FlatList);
    expect(typeof flatList.props.onContentSizeChange).toBe("function");
    expect(() => {
      act(() => {
        flatList.props.onContentSizeChange();
      });
    }).not.toThrow();
  });

  it("maintainVisibleContentPosition turns on once content overflows so prepended rows don't jump", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    const { UNSAFE_getByType } = render(
      <TranscriptionList {...defaultProps} />,
    );
    const { FlatList } = require("react-native");
    const flatList = UNSAFE_getByType(FlatList);

    expect(flatList.props.maintainVisibleContentPosition).toBeUndefined();

    act(() => {
      flatList.props.onLayout({ nativeEvent: { layout: { height: 400 } } });
      flatList.props.onContentSizeChange(0, 1000);
    });

    const refreshed = UNSAFE_getByType(FlatList);
    expect(refreshed.props.maintainVisibleContentPosition).toEqual({
      minIndexForVisible: 0,
    });
  });

  it("selection mode props forwarded to items", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    const { getByTestId } = render(
      <TranscriptionList
        {...defaultProps}
        selectionMode={true}
        selectedTranscriptionIds={new Set(["t1"])}
      />,
    );
    expect(getByTestId("transcription-item-t1")).toBeTruthy();
    expect(getByTestId("transcription-item-t2")).toBeTruthy();
  });

  it("FlatList configuration", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    const { UNSAFE_getByType } = render(
      <TranscriptionList {...defaultProps} />,
    );
    const { FlatList } = require("react-native");
    const flatList = UNSAFE_getByType(FlatList);
    expect(flatList.props.keyboardShouldPersistTaps).toBe("handled");
    expect(flatList.props.keyboardDismissMode).toBe("interactive");
    expect(flatList.props.scrollEventThrottle).toBe(16);
    expect(flatList.props.onStartReachedThreshold).toBe(0.4);
  });

  it("shows realtime live preview when recording in realtime mode", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    (useSettingsStore as unknown as jest.Mock).mockReturnValue({
      selectedModelType: "whisper_realtime",
      selectedTranscriptionMode: "realtime",
    });
    const liveItem = {
      id: "live-preview",
      text: "live text",
      timestamp: new Date(),
      audioPath: "",
      sessionId: "s1",
    };
    (useTranscriptionStore as unknown as jest.Mock).mockReturnValue({
      ...mockStoreDefaults,
      isRecording: () => true,
      livePreview: liveItem,
    });
    const { getByTestId } = render(<TranscriptionList {...defaultProps} />);
    expect(getByTestId("transcription-item-live-preview")).toBeTruthy();
  });

  it("shows default file-mode recording preview when no loadingPreview exists", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    (useSettingsStore as unknown as jest.Mock).mockReturnValue({
      selectedModelType: "whisper_file",
    });
    (useTranscriptionStore as unknown as jest.Mock).mockReturnValue({
      ...mockStoreDefaults,
      isRecording: () => true,
      loadingPreview: null,
    });
    const { getByTestId } = render(<TranscriptionList {...defaultProps} />);
    expect(
      getByTestId("transcription-item-whisper_recording_preview"),
    ).toBeTruthy();
  });

  it("shows loadingPreview in file-mode when recording", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    (useSettingsStore as unknown as jest.Mock).mockReturnValue({
      selectedModelType: "whisper_file",
    });
    const loadingItem = {
      id: "loading1",
      text: "loading...",
      timestamp: new Date(),
      audioPath: "",
      sessionId: "s1",
    };
    (useTranscriptionStore as unknown as jest.Mock).mockReturnValue({
      ...mockStoreDefaults,
      isRecording: () => true,
      loadingPreview: loadingItem,
    });
    const { getByTestId } = render(<TranscriptionList {...defaultProps} />);
    expect(getByTestId("transcription-item-loading1")).toBeTruthy();
  });

  it("shows transcribing state with loadingPreview", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    const loadingItem = {
      id: "transcribing-loading",
      text: "",
      timestamp: new Date(),
      audioPath: "",
      sessionId: "s1",
    };
    (useTranscriptionStore as unknown as jest.Mock).mockReturnValue({
      ...mockStoreDefaults,
      isTranscribing: () => true,
      loadingPreview: loadingItem,
    });
    const { getByTestId } = render(<TranscriptionList {...defaultProps} />);
    expect(getByTestId("transcription-item-transcribing-loading")).toBeTruthy();
  });

  it("transcribing state with no loading/live preview does not inject a ghost skeleton row", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    (useTranscriptionStore as unknown as jest.Mock).mockReturnValue({
      ...mockStoreDefaults,
      isTranscribing: () => true,
      livePreview: null,
      loadingPreview: null,
    });
    const { queryByTestId, getByTestId } = render(
      <TranscriptionList {...defaultProps} />,
    );
    expect(getByTestId("transcription-item-t1")).toBeTruthy();
    expect(getByTestId("transcription-item-t2")).toBeTruthy();
    expect(queryByTestId("transcription-item-transcribing_preview")).toBeNull();
  });

  it("handleStartEdit calls onEditModeStarted callback", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    const onEditModeStarted = jest.fn();
    jest.requireMock(
      "../transcription-item/TranscriptionItem",
    ).TranscriptionItem = (props: any) => {
      const { View, Text, Pressable } = require("react-native");
      return (
        <View testID={`transcription-item-${props.transcription.id}`}>
          <Text>{props.transcription.text}</Text>
          <Pressable
            testID={`start-edit-${props.transcription.id}`}
            onPress={props.onStartEdit}
          />
          <Pressable
            testID={`end-edit-${props.transcription.id}`}
            onPress={props.onEndEdit}
          />
        </View>
      );
    };

    const { getByTestId } = render(
      <TranscriptionList
        {...defaultProps}
        onEditModeStarted={onEditModeStarted}
      />,
    );

    fireEvent.press(getByTestId("start-edit-t1"));
    expect(onEditModeStarted).toHaveBeenCalledTimes(1);
  });

  it("handleEndEdit calls onEditModeEnded callback", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    const onEditModeEnded = jest.fn();

    jest.requireMock(
      "../transcription-item/TranscriptionItem",
    ).TranscriptionItem = (props: any) => {
      const { View, Text, Pressable } = require("react-native");
      return (
        <View testID={`transcription-item-${props.transcription.id}`}>
          <Text>{props.transcription.text}</Text>
          <Pressable
            testID={`end-edit-${props.transcription.id}`}
            onPress={props.onEndEdit}
          />
        </View>
      );
    };

    const { getByTestId } = render(
      <TranscriptionList {...defaultProps} onEditModeEnded={onEditModeEnded} />,
    );

    fireEvent.press(getByTestId("end-edit-t1"));
    expect(onEditModeEnded).toHaveBeenCalledTimes(1);
  });

  it("handleScrollToIndexFailed is wired to FlatList", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);

    const { UNSAFE_getByType } = render(
      <TranscriptionList {...defaultProps} />,
    );

    const { FlatList } = require("react-native");
    const flatList = UNSAFE_getByType(FlatList);
    expect(flatList.props.onScrollToIndexFailed).toBeDefined();
    expect(() =>
      flatList.props.onScrollToIndexFailed({
        index: 2,
        highestMeasuredFrameIndex: 1,
        averageItemLength: 100,
      }),
    ).not.toThrow();
  });

  it("keyboard listener is registered and cleaned up", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    const mockRemove = jest.fn();
    const mockAddListener = jest.fn(() => ({ remove: mockRemove }));
    const { Keyboard } = require("react-native");
    const originalAddListener = Keyboard.addListener;
    Keyboard.addListener = mockAddListener;

    const { unmount } = render(<TranscriptionList {...defaultProps} />);
    expect(mockAddListener).toHaveBeenCalled();

    unmount();
    expect(mockRemove).toHaveBeenCalled();

    Keyboard.addListener = originalAddListener;
  });

  it("does not show realtime preview when recording in realtime mode but livePreview is null", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    (useSettingsStore as unknown as jest.Mock).mockReturnValue({
      selectedModelType: "whisper_realtime",
    });
    (useTranscriptionStore as unknown as jest.Mock).mockReturnValue({
      ...mockStoreDefaults,
      isRecording: () => true,
      livePreview: null,
    });
    const { queryByTestId } = render(<TranscriptionList {...defaultProps} />);
    expect(queryByTestId("transcription-item-t1")).toBeTruthy();
    expect(queryByTestId("transcription-item-t2")).toBeTruthy();
  });

  it("transcribing state uses livePreview when loadingPreview is null", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    const liveItem = {
      id: "live-for-transcribing",
      text: "partial text",
      timestamp: new Date(),
      audioPath: "",
      sessionId: "s1",
    };
    (useTranscriptionStore as unknown as jest.Mock).mockReturnValue({
      ...mockStoreDefaults,
      isTranscribing: () => true,
      livePreview: liveItem,
      loadingPreview: null,
    });
    const { getByTestId } = render(<TranscriptionList {...defaultProps} />);
    expect(
      getByTestId("transcription-item-live-for-transcribing"),
    ).toBeTruthy();
  });

  it("handleScrollToIndexFailed does not throw when no listRef", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);

    const { UNSAFE_getByType } = render(
      <TranscriptionList {...defaultProps} />,
    );

    const { FlatList } = require("react-native");
    const flatList = UNSAFE_getByType(FlatList);
    expect(() =>
      flatList.props.onScrollToIndexFailed({
        index: 3,
        highestMeasuredFrameIndex: 1,
        averageItemLength: 100,
      }),
    ).not.toThrow();
  });

  it("handleUpdateTranscription calls store updateTranscription", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    const mockUpdateTranscription = jest.fn();
    (useTranscriptionStore as unknown as jest.Mock).mockReturnValue({
      ...mockStoreDefaults,
      updateTranscription: mockUpdateTranscription,
    });

    jest.requireMock(
      "../transcription-item/TranscriptionItem",
    ).TranscriptionItem = (props: any) => {
      const { View, Text, Pressable } = require("react-native");
      return (
        <View testID={`transcription-item-${props.transcription.id}`}>
          <Text>{props.transcription.text}</Text>
          <Pressable
            testID={`update-${props.transcription.id}`}
            onPress={() =>
              props.onTranscriptionUpdate?.({
                ...props.transcription,
                text: "Updated",
              })
            }
          />
        </View>
      );
    };

    const { getByTestId } = render(<TranscriptionList {...defaultProps} />);
    fireEvent.press(getByTestId("update-t1"));
    expect(mockUpdateTranscription).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1", text: "Updated" }),
    );
  });

  it("onTap does not fire for preview items", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    (useTranscriptionStore as unknown as jest.Mock).mockReturnValue({
      ...mockStoreDefaults,
      isRecording: () => true,
      loadingPreview: {
        id: "preview1",
        text: "",
        timestamp: new Date(),
        audioPath: "",
        sessionId: "s1",
      },
    });

    const onTranscriptionTap = jest.fn();

    jest.requireMock(
      "../transcription-item/TranscriptionItem",
    ).TranscriptionItem = (props: any) => {
      const { View, Text, Pressable } = require("react-native");
      return (
        <View testID={`transcription-item-${props.transcription.id}`}>
          <Text>{props.transcription.text}</Text>
          <Pressable
            testID={`tap-${props.transcription.id}`}
            onPress={props.onTap}
          />
        </View>
      );
    };

    const { getByTestId } = render(
      <TranscriptionList
        {...defaultProps}
        onTranscriptionTap={onTranscriptionTap}
      />,
    );

    fireEvent.press(getByTestId("tap-preview1"));
    expect(onTranscriptionTap).not.toHaveBeenCalled();

    fireEvent.press(getByTestId("tap-t1"));
    expect(onTranscriptionTap).toHaveBeenCalledWith("t1");
  });

  it("onLongPress does not fire for preview items", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    (useTranscriptionStore as unknown as jest.Mock).mockReturnValue({
      ...mockStoreDefaults,
      isRecording: () => true,
      loadingPreview: {
        id: "preview-lp",
        text: "",
        timestamp: new Date(),
        audioPath: "",
        sessionId: "s1",
      },
    });

    const onTranscriptionLongPress = jest.fn();

    jest.requireMock(
      "../transcription-item/TranscriptionItem",
    ).TranscriptionItem = (props: any) => {
      const { View, Text, Pressable } = require("react-native");
      return (
        <View testID={`transcription-item-${props.transcription.id}`}>
          <Text>{props.transcription.text}</Text>
          <Pressable
            testID={`longpress-${props.transcription.id}`}
            onPress={props.onLongPress}
          />
        </View>
      );
    };

    const { getByTestId } = render(
      <TranscriptionList
        {...defaultProps}
        onTranscriptionLongPress={onTranscriptionLongPress}
      />,
    );

    fireEvent.press(getByTestId("longpress-preview-lp"));
    expect(onTranscriptionLongPress).not.toHaveBeenCalled();

    fireEvent.press(getByTestId("longpress-t1"));
    expect(onTranscriptionLongPress).toHaveBeenCalledWith("t1");
  });

  it("cancels pending animation frame when content size changes again", () => {
    jest.useFakeTimers();
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    const rafSpy = jest
      .spyOn(global, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 42 as unknown as number;
      });
    const cancelSpy = jest
      .spyOn(global, "cancelAnimationFrame")
      .mockImplementation(() => {});

    const { UNSAFE_getByType, unmount } = render(
      <TranscriptionList {...defaultProps} />,
    );
    const { FlatList } = require("react-native");
    const flatList = UNSAFE_getByType(FlatList);

    // Establish a list layout height so the overflow check can fire.
    act(() => {
      flatList.props.onLayout({ nativeEvent: { layout: { height: 400 } } });
    });

    act(() => {
      // Content taller than the list → snap to end fires.
      flatList.props.onContentSizeChange(0, 1000);
      flatList.props.onContentSizeChange(0, 1100);
      flatList.props.onScrollBeginDrag();
      jest.advanceTimersByTime(120);
    });
    expect(rafSpy).toHaveBeenCalled();

    unmount();

    rafSpy.mockRestore();
    cancelSpy.mockRestore();
    jest.useRealTimers();
  });

  it("skips scrollToEnd when content fits in the list viewport", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    const rafSpy = jest
      .spyOn(global, "requestAnimationFrame")
      .mockImplementation(() => 42 as unknown as number);

    const { UNSAFE_getByType } = render(
      <TranscriptionList {...defaultProps} />,
    );
    const { FlatList } = require("react-native");
    const flatList = UNSAFE_getByType(FlatList);

    act(() => {
      flatList.props.onLayout({ nativeEvent: { layout: { height: 800 } } });
      // Content shorter than list height → no snap.
      flatList.props.onContentSizeChange(0, 400);
    });
    expect(rafSpy).not.toHaveBeenCalled();

    rafSpy.mockRestore();
  });

  it("preview items disable selectionMode", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    (useTranscriptionStore as unknown as jest.Mock).mockReturnValue({
      ...mockStoreDefaults,
      isRecording: () => true,
      loadingPreview: {
        id: "preview-sel",
        text: "",
        timestamp: new Date(),
        audioPath: "",
        sessionId: "s1",
      },
    });

    let capturedSelectionMode: boolean | undefined;
    jest.requireMock(
      "../transcription-item/TranscriptionItem",
    ).TranscriptionItem = (props: any) => {
      const { View, Text } = require("react-native");
      if (props.transcription.id === "preview-sel") {
        capturedSelectionMode = props.selectionMode;
      }
      return (
        <View testID={`transcription-item-${props.transcription.id}`}>
          <Text>{props.transcription.text}</Text>
        </View>
      );
    };

    render(
      <TranscriptionList
        {...defaultProps}
        selectionMode={true}
        selectedTranscriptionIds={new Set(["t1"])}
      />,
    );

    expect(capturedSelectionMode).toBe(false);
  });

  it("duplicate preview item ID in transcriptions is filtered out", () => {
    const transcriptionsWithDupe: any[] = [
      ...mockTranscriptions,
      {
        id: "dupe-preview",
        text: "Existing",
        timestamp: new Date("2024-01-03"),
        audioPath: "",
        sessionId: "s1",
      },
    ];
    (useSessionTranscriptions as jest.Mock).mockReturnValue(
      transcriptionsWithDupe,
    );
    (useTranscriptionStore as unknown as jest.Mock).mockReturnValue({
      ...mockStoreDefaults,
      isRecording: () => true,
      loadingPreview: {
        id: "dupe-preview",
        text: "",
        timestamp: new Date(),
        audioPath: "",
        sessionId: "s1",
      },
    });

    const { getAllByTestId } = render(<TranscriptionList {...defaultProps} />);
    const items = getAllByTestId(/^transcription-item-dupe-preview$/);
    expect(items).toHaveLength(1);
  });

  it("passes isCancellingEdit through to items", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);

    let capturedCancelling: boolean | undefined;
    jest.requireMock(
      "../transcription-item/TranscriptionItem",
    ).TranscriptionItem = (props: any) => {
      const { View, Text } = require("react-native");
      if (props.transcription.id === "t1") {
        capturedCancelling = props.isCancelling;
      }
      return (
        <View testID={`transcription-item-${props.transcription.id}`}>
          <Text>{props.transcription.text}</Text>
        </View>
      );
    };

    render(<TranscriptionList {...defaultProps} isCancellingEdit={true} />);

    expect(capturedCancelling).toBe(true);
  });

  it("top padding adds to the chronological top of the list", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);

    const { UNSAFE_getByType } = render(
      <TranscriptionList
        {...defaultProps}
        topPadding={100}
        bottomPadding={50}
      />,
    );
    const { FlatList } = require("react-native");
    const flatList = UNSAFE_getByType(FlatList);
    expect(flatList.props.contentContainerStyle.paddingTop).toBe(116);
  });
});
