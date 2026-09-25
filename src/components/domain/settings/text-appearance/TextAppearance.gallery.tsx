import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { FontOptionGrid, FontSizeSlider, TextPreviewCard } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";
import { DEFAULT_TEXT_APPEARANCE, type TextAppearance } from "@/models";

const SAMPLE = "The quick brown fox jumps over the lazy dog.";

export const Playground = () => {
  const [appearance, setAppearance] = useState<TextAppearance>(
    DEFAULT_TEXT_APPEARANCE,
  );
  const update = (patch: Partial<TextAppearance>) =>
    setAppearance((prev) => ({ ...prev, ...patch }));
  return (
    <View style={styles.column}>
      <TextPreviewCard text={SAMPLE} appearance={appearance} />
      <FontSizeSlider
        value={appearance.size}
        onChange={(size) => update({ size })}
      />
      <FontOptionGrid
        value={appearance.font}
        onChange={(font) => update({ font })}
      />
    </View>
  );
};

export const BoldPreview = () => (
  <TextPreviewCard
    text={SAMPLE}
    appearance={{ font: "literata", size: 20, bold: true }}
  />
);

const styles = StyleSheet.create({
  column: {
    gap: 24,
  },
});

const gallery: GalleryEntry = {
  slug: "text-appearance",
  title: "Text Appearance",
  group: "Domain",
  demos: [
    { name: "Playground", render: Playground },
    { name: "BoldPreview", render: BoldPreview },
  ],
};

export default gallery;
