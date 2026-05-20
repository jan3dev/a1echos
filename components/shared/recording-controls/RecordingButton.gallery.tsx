import { ComponentProps } from "react";

import type { GalleryEntry } from "@/app/(dev)/design-system/manifest";
import { RecordingButton } from "@/components";
import { TranscriptionState } from "@/models";
import { useTheme } from "@/theme";

const DynamicRecordingButton = (
  props: Omit<ComponentProps<typeof RecordingButton>, "colors">,
) => {
  const { theme } = useTheme();
  return <RecordingButton {...props} colors={theme.colors} />;
};

export const Ready = () => (
  <DynamicRecordingButton
    state={TranscriptionState.READY}
    enabled={true}
    onRecordingStart={() => console.log("Recording started")}
  />
);

export const Recording = () => (
  <DynamicRecordingButton
    state={TranscriptionState.RECORDING}
    enabled={true}
    onRecordingStop={() => console.log("Recording stopped")}
  />
);

export const Transcribing = () => (
  <DynamicRecordingButton
    state={TranscriptionState.TRANSCRIBING}
    enabled={false}
  />
);

export const Loading = () => (
  <DynamicRecordingButton state={TranscriptionState.LOADING} enabled={false} />
);

const gallery: GalleryEntry = {
  slug: "recording-button",
  title: "Recording Button",
  group: "Shared",
  demos: [
    { name: "Ready", render: Ready },
    { name: "Recording", render: Recording },
    { name: "Transcribing", render: Transcribing },
    { name: "Loading", render: Loading },
  ],
};

export default gallery;
