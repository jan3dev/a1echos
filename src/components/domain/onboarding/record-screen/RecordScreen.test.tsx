/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";

import { TranscriptionState } from "@/models";

import { RecordScreen, RecordScreenProps } from "./RecordScreen";

jest.mock("../../../shared/recording-controls/RecordingControlsView", () => ({
  RecordingControlsView: (props: {
    onRecordingStart: () => void;
    onRecordingStop: () => void;
  }) => {
    const { TouchableOpacity, View } = require("react-native");
    return (
      <View>
        <TouchableOpacity testID="start" onPress={props.onRecordingStart} />
        <TouchableOpacity testID="stop" onPress={props.onRecordingStop} />
      </View>
    );
  },
}));

const transcription = {
  id: "t1",
  sessionId: "s",
  text: "Hello from Echos",
  timestamp: new Date(),
  audioPath: "",
};

const makeProps = (
  overrides: Partial<RecordScreenProps> = {},
): RecordScreenProps => ({
  state: TranscriptionState.READY,
  transcriptions: [],
  onRecordingStart: jest.fn(),
  onRecordingStop: jest.fn(),
  onTranscriptionUpdate: jest.fn(),
  onDelete: jest.fn(),
  onCopy: jest.fn(),
  onShare: jest.fn(),
  onBack: jest.fn(),
  onSkip: jest.fn(),
  onNext: jest.fn(),
  testID: "r",
  ...overrides,
});

describe("RecordScreen", () => {
  it("shows the record controls in the empty state", () => {
    const props = makeProps();
    const { getByText, getByTestId, queryByTestId } = render(
      <RecordScreen {...props} />,
    );
    expect(getByText("onboardingRecordTitle")).toBeTruthy();
    expect(queryByTestId("r-next")).toBeNull();
    expect(queryByTestId("r-actions")).toBeNull();
    fireEvent.press(getByTestId("start"));
    fireEvent.press(getByTestId("r-back"));
    fireEvent.press(getByTestId("r-skip"));
    expect(props.onRecordingStart).toHaveBeenCalledTimes(1);
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.onSkip).toHaveBeenCalledTimes(1);
  });

  it("ticks the timer and shows the live preview while recording", () => {
    jest.useFakeTimers();
    const props = makeProps({
      state: TranscriptionState.RECORDING,
      liveText: "Live words",
    });
    const { getByTestId, getByText } = render(<RecordScreen {...props} />);
    expect(getByText("Live words")).toBeTruthy();
    expect(getByTestId("r-timer")).toHaveTextContent("00:00");
    act(() => jest.advanceTimersByTime(65_000));
    expect(getByTestId("r-timer")).toHaveTextContent("01:05");
    fireEvent.press(getByTestId("stop"));
    expect(props.onRecordingStop).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("shows the transcript with delete, copy, share and next once done", () => {
    const props = makeProps({ transcriptions: [transcription] });
    const { getByText, getByTestId, queryByTestId } = render(
      <RecordScreen {...props} />,
    );
    expect(getByText("onboardingTranscriptReadyTitle")).toBeTruthy();
    expect(getByText("Hello from Echos")).toBeTruthy();
    expect(queryByTestId("start")).toBeNull();
    fireEvent.press(getByTestId("r-delete"));
    fireEvent.press(getByTestId("r-copy"));
    fireEvent.press(getByTestId("r-share"));
    fireEvent.press(getByTestId("r-next"));
    expect(props.onDelete).toHaveBeenCalledTimes(1);
    expect(props.onCopy).toHaveBeenCalledTimes(1);
    expect(props.onShare).toHaveBeenCalledTimes(1);
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  it("edits the transcript on tap", () => {
    const props = makeProps({ transcriptions: [transcription] });
    const { getByText, getByDisplayValue } = render(
      <RecordScreen {...props} />,
    );
    fireEvent.press(getByText("Hello from Echos"));
    const input = getByDisplayValue("Hello from Echos");
    fireEvent.changeText(input, "Edited");
    fireEvent(input, "blur");
    expect(props.onTranscriptionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1", text: "Edited" }),
    );
  });

  it("renders without a testID", () => {
    const { getByText } = render(
      <RecordScreen {...makeProps({ testID: undefined })} />,
    );
    expect(getByText("onboardingRecordSubtitle")).toBeTruthy();
  });
});
