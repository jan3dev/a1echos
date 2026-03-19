/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React from "react";

import { Transcription } from "@/models";

import { TranscriptionItem } from "./TranscriptionItem";

jest.mock("@/stores", () => ({
  useUIStore: jest.fn((selector) => {
    if (typeof selector === "function") {
      return selector({ showGlobalTooltip: jest.fn() });
    }
    return { showGlobalTooltip: jest.fn() };
  }),
}));

jest.mock("../../ui/icon/Icon", () => ({
  Icon: (props: any) => {
    const { View } = require("react-native");
    return <View testID={`icon-${props.name}`} />;
  },
}));

jest.mock("../../ui/ripple-pressable/RipplePressable", () => ({
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

jest.mock("../../ui/checkbox/Checkbox", () => ({
  Checkbox: () => {
    const { View } = require("react-native");
    return <View testID="checkbox" />;
  },
}));

jest.mock("../../ui/skeleton/Skeleton", () => ({
  Skeleton: () => {
    const { View } = require("react-native");
    return <View testID="skeleton" />;
  },
}));

jest.mock("../../ui/text/Text", () => ({
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

  it("shows edit and copy icons in normal mode", () => {
    const { getByTestId } = render(<TranscriptionItem {...defaultProps} />);
    expect(getByTestId("icon-edit")).toBeTruthy();
    expect(getByTestId("icon-copy")).toBeTruthy();
  });

  it("copy icon copies text to clipboard and triggers haptics", async () => {
    const { getByTestId } = render(<TranscriptionItem {...defaultProps} />);
    fireEvent.press(getByTestId("icon-copy").parent!);
    await waitFor(() => {
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
        "Hello world transcription",
      );
    });
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it("edit mode shows TextInput", () => {
    const { UNSAFE_getByType } = render(
      <TranscriptionItem {...defaultProps} isEditing={true} />,
    );
    const { TextInput } = require("react-native");
    expect(UNSAFE_getByType(TextInput)).toBeTruthy();
  });

  it("selection mode shows checkbox", () => {
    const { getByTestId, queryByTestId } = render(
      <TranscriptionItem
        {...defaultProps}
        selectionMode={true}
        isSelected={false}
      />,
    );
    expect(getByTestId("checkbox")).toBeTruthy();
    expect(queryByTestId("icon-edit")).toBeNull();
    expect(queryByTestId("icon-copy")).toBeNull();
  });

  it("live preview mode hides edit/copy icons", () => {
    const { queryByTestId } = render(
      <TranscriptionItem {...defaultProps} isLivePreviewItem={true} />,
    );
    expect(queryByTestId("icon-edit")).toBeNull();
    expect(queryByTestId("icon-copy")).toBeNull();
  });

  it("loading state shows skeleton", () => {
    const { getAllByTestId } = render(
      <TranscriptionItem {...defaultProps} isLoadingWhisperResult={true} />,
    );
    expect(getAllByTestId("skeleton").length).toBeGreaterThanOrEqual(1);
  });
});
