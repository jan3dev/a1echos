import { View } from "react-native";

import { RecordScreen, type RecordScreenProps } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";
import { TranscriptionState } from "@/models";

const noop = () => {};

const baseProps: RecordScreenProps = {
  state: TranscriptionState.READY,
  transcriptions: [],
  onRecordingStart: noop,
  onRecordingStop: noop,
  onTranscriptionUpdate: noop,
  onDelete: () => console.log("Delete"),
  onCopy: () => console.log("Copy"),
  onShare: () => console.log("Share"),
  onBack: () => console.log("Back"),
  onSkip: () => console.log("Skip"),
  onNext: () => console.log("Next"),
};

const Frame = (props: Partial<RecordScreenProps>) => (
  <View style={{ height: 720, borderRadius: 16, overflow: "hidden" }}>
    <RecordScreen {...baseProps} {...props} />
  </View>
);

export const Empty = () => <Frame />;

export const Recording = () => <Frame state={TranscriptionState.RECORDING} />;

export const Transcribed = () => (
  <Frame
    transcriptions={[
      {
        id: "1",
        sessionId: "s",
        text: "Testing Echos for the first time. It is turning everything I say into text, and none of it leaves my phone.",
        timestamp: new Date(),
        audioPath: "",
      },
    ]}
  />
);

const gallery: GalleryEntry = {
  slug: "record-screen",
  title: "Record Screen",
  group: "Domain",
  demos: [
    { name: "Empty", render: Empty },
    { name: "Recording", render: Recording },
    { name: "Transcribed", render: Transcribed },
  ],
};

export default gallery;
