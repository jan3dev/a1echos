import { useState } from "react";

import { Button, TranscriptionSettingsSheet } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";

const Default = () => {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Button.primary text="Open sheet" onPress={() => setVisible(true)} />
      <TranscriptionSettingsSheet
        visible={visible}
        onDismiss={() => setVisible(false)}
      />
    </>
  );
};

const gallery: GalleryEntry = {
  slug: "transcription-settings-sheet",
  title: "Transcription Settings Sheet",
  group: "Domain",
  demos: [{ name: "Default", render: Default }],
};

export default gallery;
