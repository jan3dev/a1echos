import { View } from "react-native";

import { Text } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";

export const Default = () => (
  <Text>The quick brown fox jumps over the lazy dog</Text>
);

export const Variants = () => (
  <View style={{ gap: 16 }}>
    <Text variant="h1">Heading 1</Text>
    <Text variant="h2">Heading 2</Text>
    <Text variant="h3">Heading 3</Text>
    <Text variant="h4">Heading 4</Text>
    <Text variant="h5">Heading 5</Text>
    <Text variant="subtitle">Subtitle</Text>
    <Text variant="body1">Body 1 - Main text content</Text>
    <Text variant="body2">Body 2 - Secondary text content</Text>
    <Text variant="caption1">Caption 1 - Small helper text</Text>
    <Text variant="caption2">Caption 2 - Tiny labels</Text>
  </View>
);

export const Weights = () => (
  <View style={{ gap: 16 }}>
    <Text variant="h3" weight="regular">
      Regular Weight
    </Text>
    <Text variant="h3" weight="medium">
      Medium Weight
    </Text>
    <Text variant="h3" weight="semibold">
      SemiBold Weight
    </Text>
  </View>
);

const gallery: GalleryEntry = {
  slug: "text",
  title: "Text",
  group: "UI",
  demos: [
    { name: "Default", render: Default },
    { name: "Variants", render: Variants },
    { name: "Weights", render: Weights },
  ],
};

export default gallery;
