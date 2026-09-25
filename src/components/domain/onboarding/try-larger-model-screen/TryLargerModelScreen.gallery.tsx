import { useState } from "react";
import { View } from "react-native";

import { TryLargerModelScreen } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";
import { getModelInfo, ModelId } from "@/models";

const model = getModelInfo(ModelId.NEMO_PARAKEET_V3);

const Screen = ({ downloaded = false }: { downloaded?: boolean }) => {
  const [isDownloaded, setIsDownloaded] = useState(downloaded);
  return (
    <TryLargerModelScreen
      model={model}
      isDownloaded={isDownloaded}
      isSelected={isDownloaded}
      onDownload={() => setIsDownloaded(true)}
      onCancelDownload={() => console.log("Cancel")}
      onSelect={() => console.log("Select")}
      onBack={() => console.log("Back")}
      onNext={() => console.log("Next")}
    />
  );
};

export const Default = () => (
  <View style={{ height: 720, borderRadius: 16, overflow: "hidden" }}>
    <Screen />
  </View>
);

export const Downloaded = () => (
  <View style={{ height: 720, borderRadius: 16, overflow: "hidden" }}>
    <Screen downloaded />
  </View>
);

export const Landscape = () => (
  <View
    style={{ width: 720, height: 360, borderRadius: 16, overflow: "hidden" }}
  >
    <Screen />
  </View>
);

const gallery: GalleryEntry = {
  slug: "try-larger-model-screen",
  title: "Try Larger Model Screen",
  group: "Domain",
  demos: [
    { name: "Default", render: Default },
    { name: "Downloaded", render: Downloaded },
    { name: "Landscape", render: Landscape },
  ],
};

export default gallery;
