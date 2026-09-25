import { View } from "react-native";

import { GlowCtaButton } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";
import { darkColors, spacing } from "@/theme";

const Default = () => (
  <View
    style={{
      padding: spacing.md,
      backgroundColor: darkColors.surfaceBackground,
    }}
  >
    <GlowCtaButton text="Get Started" onPress={() => console.log("Press")} />
  </View>
);

const gallery: GalleryEntry = {
  slug: "glow-cta-button",
  title: "Glow CTA Button",
  group: "Domain",
  demos: [{ name: "Default", render: Default }],
};

export default gallery;
