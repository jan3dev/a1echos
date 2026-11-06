import { useState } from "react";

import { Button, GrabberArc, TranscriptionSettingsSheet } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";
import { useTheme } from "@/theme";

const Default = () => {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Button.primary text="Open Sheet" onPress={() => setVisible(true)} />
      <TranscriptionSettingsSheet
        visible={visible}
        onDismiss={() => setVisible(false)}
      />
    </>
  );
};

const Grabber = () => {
  const { theme } = useTheme();
  return <GrabberArc color={theme.colors.systemBackgroundColor} />;
};

const gallery: GalleryEntry = {
  slug: "transcription-settings-sheet",
  title: "Transcription Settings Sheet",
  group: "Domain",
  demos: [
    { name: "Default", render: Default },
    { name: "Grabber Arc", render: Grabber },
  ],
};

export default gallery;
