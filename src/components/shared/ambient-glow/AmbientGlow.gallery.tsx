import { View } from "react-native";

import { AmbientGlow } from "@/components";
import { AquaPrimitiveColors } from "@/theme";
import type { GalleryEntry } from "@/design-system/manifest";

const Stage = ({ children }: { children: React.ReactNode }) => (
  <View
    style={{
      height: 320,
      width: "100%",
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: AquaPrimitiveColors.metal1000,
    }}
  >
    {children}
  </View>
);

export const Default = () => (
  <Stage>
    <AmbientGlow />
  </Stage>
);

export const Static = () => (
  <Stage>
    <AmbientGlow animated={false} />
  </Stage>
);

export const Intense = () => (
  <Stage>
    <AmbientGlow intensity={0.85} />
  </Stage>
);

const gallery: GalleryEntry = {
  slug: "ambient-glow",
  title: "Ambient Glow",
  group: "Shared",
  demos: [
    { name: "Default", render: Default },
    { name: "Static", render: Static },
    { name: "Intense", render: Intense },
  ],
};

export default gallery;
