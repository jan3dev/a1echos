import { View } from "react-native";

import { Surface, Text } from "@/components";
import type { GalleryEntry } from "@/app/(design-system)/manifest";

export const Default = () => (
  <Surface padding={16}>
    <Text>Surface Content</Text>
  </Surface>
);

export const Elevations = () => (
  <View style={{ gap: 24 }}>
    <Surface elevation={0} padding={16}>
      <Text>Elevation 0 (Flat)</Text>
    </Surface>
    <Surface elevation={2} padding={16}>
      <Text>Elevation 2 (Small)</Text>
    </Surface>
    <Surface elevation={4} padding={16}>
      <Text>Elevation 4 (Medium)</Text>
    </Surface>
    <Surface elevation={8} padding={16}>
      <Text>Elevation 8 (Large)</Text>
    </Surface>
  </View>
);

export const GlassEffect = () => (
  <View
    style={{
      height: 320,
      backgroundColor: "#7a92f3",
      padding: 32,
      justifyContent: "center",
      gap: 24,
    }}
  >
    <Surface variant="glass" padding={24} borderRadius={16}>
      <Text weight="semibold" style={{ color: "#000" }}>
        Glass Surface
      </Text>
      <Text variant="caption1" style={{ color: "#000", marginTop: 4 }}>
        Blur effect over background
      </Text>
    </Surface>

    <Surface
      variant="glass"
      padding={24}
      borderRadius={16}
      color="rgba(0,0,0,0.4)"
    >
      <Text weight="semibold" style={{ color: "#fff" }}>
        Dark Glass
      </Text>
      <Text variant="caption1" style={{ color: "#fff", marginTop: 4 }}>
        With custom dark tint
      </Text>
    </Surface>
  </View>
);

const gallery: GalleryEntry = {
  slug: "surface",
  title: "Surface",
  group: "UI",
  demos: [
    { name: "Default", render: Default },
    { name: "Elevations", render: Elevations },
    { name: "GlassEffect", render: GlassEffect },
  ],
};

export default gallery;
