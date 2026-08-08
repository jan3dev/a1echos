import { View } from "react-native";

import { DownloadProgressBar, Text } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";

const Steps = () => (
  <View style={{ gap: 16 }}>
    {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
      <View key={ratio} style={{ gap: 6 }}>
        <Text variant="caption1" weight="medium">
          {Math.round(ratio * 100)}%
        </Text>
        <DownloadProgressBar ratio={ratio} />
      </View>
    ))}
  </View>
);

export const Default = () => <DownloadProgressBar ratio={0.42} />;

export const AllVariants = () => <Steps />;

// Out-of-range and NaN ratios clamp rather than painting past the track.
export const Clamped = () => (
  <View style={{ gap: 16 }}>
    <DownloadProgressBar ratio={-1} />
    <DownloadProgressBar ratio={2} />
    <DownloadProgressBar ratio={NaN} />
  </View>
);

const gallery: GalleryEntry = {
  slug: "download-progress-bar",
  title: "Download Progress Bar",
  group: "UI",
  demos: [
    { name: "Default", render: Default },
    { name: "AllVariants", render: AllVariants },
    { name: "Clamped", render: Clamped },
  ],
};

export default gallery;
