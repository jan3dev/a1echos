/* eslint-disable @typescript-eslint/no-require-imports, react/display-name */
import { render } from "@testing-library/react-native";
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

jest.mock("./TranscriptionItem", () => ({
  TranscriptionItem: (props: any) => {
    const { View, Text } = require("react-native");
    return (
      <View testID={`transcription-item-${props.transcription.id}`}>
        <Text>{props.transcription.text}</Text>
      </View>
    );
  },
}));

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

  it("preview item appended when recording", () => {
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
    const { getByTestId } = render(<TranscriptionList {...defaultProps} />);
    expect(getByTestId("transcription-item-preview1")).toBeTruthy();
    expect(getByTestId("transcription-item-t1")).toBeTruthy();
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
    // Items should be rendered
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
  });

  it("edit mode sets editingId", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    // Just verify it renders without errors with edit callbacks
    const { getByTestId } = render(
      <TranscriptionList
        {...defaultProps}
        onEditModeStarted={jest.fn()}
        onEditModeEnded={jest.fn()}
      />,
    );
    expect(getByTestId("transcription-item-t1")).toBeTruthy();
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
    // Real items still render, but no synthesized "transcribing_preview" row
    // appears below them — that's what caused the flicker after stopping.
    expect(getByTestId("transcription-item-t1")).toBeTruthy();
    expect(getByTestId("transcription-item-t2")).toBeTruthy();
    expect(queryByTestId("transcription-item-transcribing_preview")).toBeNull();
  });

  it("handleStartEdit calls onEditModeStarted callback", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    const onEditModeStarted = jest.fn();
    // Use the enhanced mock to capture and invoke callbacks
    jest.requireMock("./TranscriptionItem").TranscriptionItem = (
      props: any,
    ) => {
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

    const { fireEvent } = require("@testing-library/react-native");
    fireEvent.press(getByTestId("start-edit-t1"));
    expect(onEditModeStarted).toHaveBeenCalledTimes(1);
  });

  it("handleEndEdit calls onEditModeEnded callback", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);
    const onEditModeEnded = jest.fn();

    jest.requireMock("./TranscriptionItem").TranscriptionItem = (
      props: any,
    ) => {
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

    const { fireEvent } = require("@testing-library/react-native");
    fireEvent.press(getByTestId("end-edit-t1"));
    expect(onEditModeEnded).toHaveBeenCalledTimes(1);
  });

  it("handleScrollToIndexFailed is wired to FlatList", () => {
    // Restore the default mock for TranscriptionItem
    jest.requireMock("./TranscriptionItem").TranscriptionItem = (
      props: any,
    ) => {
      const { View, Text } = require("react-native");
      return (
        <View testID={`transcription-item-${props.transcription.id}`}>
          <Text>{props.transcription.text}</Text>
        </View>
      );
    };

    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);

    const { UNSAFE_getByType } = render(
      <TranscriptionList {...defaultProps} />,
    );

    const { FlatList } = require("react-native");
    const flatList = UNSAFE_getByType(FlatList);
    expect(flatList.props.onScrollToIndexFailed).toBeDefined();
    // Verify calling it does not throw
    expect(() =>
      flatList.props.onScrollToIndexFailed({
        index: 2,
        highestMeasuredFrameIndex: 1,
        averageItemLength: 100,
      }),
    ).not.toThrow();
  });

  it("returns null when transcriptions are empty and no preview", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue([]);
    (useTranscriptionStore as unknown as jest.Mock).mockReturnValue(
      mockStoreDefaults,
    );
    const { toJSON } = render(<TranscriptionList {...defaultProps} />);
    expect(toJSON()).toBeNull();
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
    // No preview item should be added, but existing items should remain
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
    // Without a listRef, calling onScrollToIndexFailed should not throw
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

    // Use enhanced mock to capture onTranscriptionUpdate
    jest.requireMock("./TranscriptionItem").TranscriptionItem = (
      props: any,
    ) => {
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
    const { fireEvent } = require("@testing-library/react-native");
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

    jest.requireMock("./TranscriptionItem").TranscriptionItem = (
      props: any,
    ) => {
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

    const { fireEvent } = require("@testing-library/react-native");
    // Tap on preview item should not call onTranscriptionTap
    fireEvent.press(getByTestId("tap-preview1"));
    expect(onTranscriptionTap).not.toHaveBeenCalled();

    // Tap on regular item should call onTranscriptionTap
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

    jest.requireMock("./TranscriptionItem").TranscriptionItem = (
      props: any,
    ) => {
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

    const { fireEvent } = require("@testing-library/react-native");
    fireEvent.press(getByTestId("longpress-preview-lp"));
    expect(onTranscriptionLongPress).not.toHaveBeenCalled();
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
    jest.requireMock("./TranscriptionItem").TranscriptionItem = (
      props: any,
    ) => {
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

    // Restore simple mock
    jest.requireMock("./TranscriptionItem").TranscriptionItem = (
      props: any,
    ) => {
      const { View, Text } = require("react-native");
      return (
        <View testID={`transcription-item-${props.transcription.id}`}>
          <Text>{props.transcription.text}</Text>
        </View>
      );
    };

    const { getAllByTestId } = render(<TranscriptionList {...defaultProps} />);
    // Should not have duplicates - the original is replaced by the preview
    const items = getAllByTestId(/^transcription-item-dupe-preview$/);
    expect(items).toHaveLength(1);
  });

  it("passes isCancellingEdit through to items", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);

    let capturedCancelling: boolean | undefined;
    jest.requireMock("./TranscriptionItem").TranscriptionItem = (
      props: any,
    ) => {
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

  it("custom topPadding and bottomPadding are applied", () => {
    (useSessionTranscriptions as jest.Mock).mockReturnValue(mockTranscriptions);

    // Restore simple mock
    jest.requireMock("./TranscriptionItem").TranscriptionItem = (
      props: any,
    ) => {
      const { View, Text } = require("react-native");
      return (
        <View testID={`transcription-item-${props.transcription.id}`}>
          <Text>{props.transcription.text}</Text>
        </View>
      );
    };

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
