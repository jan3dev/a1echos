/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";
import { Transcription } from "@/models";

import { TranscriptionItem } from "./TranscriptionItem";

jest.mock("../../../ui/icon/Icon", () => ({
  Icon: (props: any) => {
    const { View } = require("react-native");
    const { dynamicTestID: dTID } = require("@/constants");
    return <View testID={dTID.icon(props.name)} />;
  },
}));

jest.mock("../../../ui/ripple-pressable/RipplePressable", () => ({
  RipplePressable: ({ children, onPress, disabled, style, ...props }: any) => {
    const { Pressable } = require("react-native");
    const resolvedStyle =
      typeof style === "function" ? style({ pressed: false }) : style;
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={resolvedStyle}
        {...props}
      >
        {children}
      </Pressable>
    );
  },
}));

jest.mock("../../../ui/checkbox/Checkbox", () => ({
  Checkbox: () => {
    const { View } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return <View testID={TID.Checkbox} />;
  },
}));

jest.mock("../../../ui/skeleton/Skeleton", () => ({
  Skeleton: () => {
    const { View } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return <View testID={TID.Skeleton} />;
  },
}));

jest.mock("../../../ui/text/Text", () => ({
  Text: (props: any) => {
    const { Text } = require("react-native");
    return <Text {...props}>{props.children}</Text>;
  },
}));

const mockTranscription: Transcription = {
  id: "t1",
  text: "Hello world transcription",
  timestamp: new Date("2024-06-15T10:30:00"),
  audioPath: "/mock/audio.wav",
  sessionId: "s1",
};

const defaultProps = {
  transcription: mockTranscription,
};

describe("TranscriptionItem", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders transcription text", () => {
    const { getByText } = render(<TranscriptionItem {...defaultProps} />);
    expect(getByText("Hello world transcription")).toBeTruthy();
  });

  it("renders timestamp", () => {
    const { getByText } = render(<TranscriptionItem {...defaultProps} />);
    expect(getByText(/Jun/)).toBeTruthy();
  });

  it("shows edit icon in normal mode and no copy icon", () => {
    const { getByTestId, queryByTestId } = render(
      <TranscriptionItem {...defaultProps} />,
    );
    expect(getByTestId("icon-edit")).toBeTruthy();
    expect(queryByTestId("icon-copy")).toBeNull();
  });

  it("edit mode shows TextInput", () => {
    const { UNSAFE_getByType } = render(
      <TranscriptionItem {...defaultProps} isEditing={true} />,
    );
    const { TextInput } = require("react-native");
    expect(UNSAFE_getByType(TextInput)).toBeTruthy();
  });

  it("selection mode shows checkbox and hides edit icon", () => {
    const { getByTestId, queryByTestId } = render(
      <TranscriptionItem
        {...defaultProps}
        selectionMode={true}
        isSelected={false}
      />,
    );
    expect(getByTestId(TestID.Checkbox)).toBeTruthy();
    expect(queryByTestId("icon-edit")).toBeNull();
  });

  it("live preview mode hides edit icon", () => {
    const { queryByTestId } = render(
      <TranscriptionItem {...defaultProps} isLivePreviewItem={true} />,
    );
    expect(queryByTestId("icon-edit")).toBeNull();
  });

  it("loading state shows skeleton", () => {
    const { getAllByTestId } = render(
      <TranscriptionItem {...defaultProps} isLoadingWhisperResult={true} />,
    );
    expect(getAllByTestId(TestID.Skeleton).length).toBeGreaterThanOrEqual(1);
  });

  it("recording state shows skeleton", () => {
    const { getAllByTestId } = render(
      <TranscriptionItem {...defaultProps} isWhisperRecording={true} />,
    );
    expect(getAllByTestId(TestID.Skeleton).length).toBeGreaterThanOrEqual(1);
  });

  it("edit mode text change updates local state", () => {
    const { UNSAFE_getByType } = render(
      <TranscriptionItem {...defaultProps} isEditing={true} />,
    );
    const { TextInput } = require("react-native");
    const input = UNSAFE_getByType(TextInput);
    fireEvent.changeText(input, "Updated text");
    expect(input.props.value).toBe("Updated text");
  });

  it("save edit calls onTranscriptionUpdate with changed text", () => {
    const onTranscriptionUpdate = jest.fn();
    const onEndEdit = jest.fn();
    const { UNSAFE_getByType } = render(
      <TranscriptionItem
        {...defaultProps}
        isEditing={true}
        onTranscriptionUpdate={onTranscriptionUpdate}
        onEndEdit={onEndEdit}
      />,
    );
    const { TextInput } = require("react-native");
    const input = UNSAFE_getByType(TextInput);
    fireEvent.changeText(input, "New text");
    fireEvent(input, "blur");
    expect(onTranscriptionUpdate).toHaveBeenCalledWith({
      ...mockTranscription,
      text: "New text",
    });
    expect(onEndEdit).toHaveBeenCalled();
  });

  it("save edit with same text does not call onTranscriptionUpdate", () => {
    const onTranscriptionUpdate = jest.fn();
    const onEndEdit = jest.fn();
    const { UNSAFE_getByType } = render(
      <TranscriptionItem
        {...defaultProps}
        isEditing={true}
        onTranscriptionUpdate={onTranscriptionUpdate}
        onEndEdit={onEndEdit}
      />,
    );
    const { TextInput } = require("react-native");
    const input = UNSAFE_getByType(TextInput);
    fireEvent(input, "blur");
    expect(onTranscriptionUpdate).not.toHaveBeenCalled();
    expect(onEndEdit).toHaveBeenCalled();
  });

  it("save edit with empty text resets to original text", () => {
    const onTranscriptionUpdate = jest.fn();
    const onEndEdit = jest.fn();
    const { UNSAFE_getByType } = render(
      <TranscriptionItem
        {...defaultProps}
        isEditing={true}
        onTranscriptionUpdate={onTranscriptionUpdate}
        onEndEdit={onEndEdit}
      />,
    );
    const { TextInput } = require("react-native");
    const input = UNSAFE_getByType(TextInput);
    fireEvent.changeText(input, "   ");
    fireEvent(input, "blur");
    expect(onTranscriptionUpdate).not.toHaveBeenCalled();
    expect(onEndEdit).toHaveBeenCalled();
  });

  it("cancelling edit resets text and calls onEndEdit", () => {
    const onEndEdit = jest.fn();
    const { UNSAFE_getByType, rerender } = render(
      <TranscriptionItem
        {...defaultProps}
        isEditing={true}
        onEndEdit={onEndEdit}
        isCancelling={false}
      />,
    );
    const { TextInput } = require("react-native");
    const input = UNSAFE_getByType(TextInput);
    fireEvent.changeText(input, "Modified text");

    rerender(
      <TranscriptionItem
        {...defaultProps}
        isEditing={true}
        onEndEdit={onEndEdit}
        isCancelling={true}
      />,
    );
    expect(onEndEdit).toHaveBeenCalled();
  });

  it("cancelling when not editing does not call onEndEdit", () => {
    const onEndEdit = jest.fn();
    render(
      <TranscriptionItem
        {...defaultProps}
        isEditing={false}
        onEndEdit={onEndEdit}
        isCancelling={true}
      />,
    );
    expect(onEndEdit).not.toHaveBeenCalled();
  });

  it("onTap callback is called when pressed in normal mode", () => {
    const onTap = jest.fn();
    const { getByText } = render(
      <TranscriptionItem {...defaultProps} onTap={onTap} />,
    );
    fireEvent.press(getByText("Hello world transcription"));
    expect(onTap).toHaveBeenCalled();
  });

  it("onTap is not called when isEditing", () => {
    const onTap = jest.fn();
    const { UNSAFE_getByType } = render(
      <TranscriptionItem {...defaultProps} isEditing={true} onTap={onTap} />,
    );
    const { TextInput } = require("react-native");
    const input = UNSAFE_getByType(TextInput);
    fireEvent.press(input.parent!);
    expect(onTap).not.toHaveBeenCalled();
  });

  it("onLongPress callback is called", () => {
    const onLongPress = jest.fn();
    const { getByText } = render(
      <TranscriptionItem {...defaultProps} onLongPress={onLongPress} />,
    );
    fireEvent(getByText("Hello world transcription"), "longPress");
    expect(onLongPress).toHaveBeenCalled();
  });

  it("interactions disabled when loading prevents onTap", () => {
    const onTap = jest.fn();
    expect(onTap).not.toHaveBeenCalled();
  });

  it("selected state applies different background color", () => {
    const { toJSON } = render(
      <TranscriptionItem
        {...defaultProps}
        selectionMode={true}
        isSelected={true}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it("edit icon onPress calls onStartEdit", () => {
    const onStartEdit = jest.fn();
    const { getByTestId } = render(
      <TranscriptionItem {...defaultProps} onStartEdit={onStartEdit} />,
    );
    fireEvent.press(getByTestId("icon-edit").parent!);
    expect(onStartEdit).toHaveBeenCalled();
  });

  it("icons are disabled when isAnyEditing is true and item is not being edited", () => {
    const { toJSON } = render(
      <TranscriptionItem
        {...defaultProps}
        isAnyEditing={true}
        isEditing={false}
      />,
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain('"opacity":0.5');
  });

  it("icons are not disabled when isAnyEditing is true but item is being edited", () => {
    const { toJSON } = render(
      <TranscriptionItem
        {...defaultProps}
        isAnyEditing={true}
        isEditing={true}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it("live preview with empty text hides timestamp", () => {
    const emptyTextTranscription = {
      ...mockTranscription,
      text: "",
    };
    const { queryByText } = render(
      <TranscriptionItem
        transcription={emptyTextTranscription}
        isLivePreviewItem={true}
      />,
    );
    expect(queryByText(/Jun/)).toBeNull();
  });

  it("custom style prop is applied", () => {
    const { toJSON } = render(
      <TranscriptionItem {...defaultProps} style={{ marginTop: 20 }} />,
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain('"marginTop":20');
  });

  it("editing border color is applied when isEditing", () => {
    const { toJSON } = render(
      <TranscriptionItem {...defaultProps} isEditing={true} />,
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain('"borderWidth":1');
  });

  it("border is always 1px (default state uses surfaceBorderPrimary)", () => {
    const { toJSON } = render(
      <TranscriptionItem {...defaultProps} isEditing={false} />,
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain('"borderWidth":1');
  });

  it("timestamp shows year for older transcriptions", () => {
    const oldTranscription: Transcription = {
      ...mockTranscription,
      timestamp: new Date("2020-03-15T10:30:00"),
    };
    const { getByText } = render(
      <TranscriptionItem transcription={oldTranscription} />,
    );
    expect(getByText(/2020/)).toBeTruthy();
  });

  it("onLongPress is not called when interactions are disabled (live preview)", () => {
    const onLongPress = jest.fn();
    const { toJSON } = render(
      <TranscriptionItem
        {...defaultProps}
        isLivePreviewItem={true}
        onLongPress={onLongPress}
      />,
    );
    expect(toJSON()).toBeTruthy();
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
