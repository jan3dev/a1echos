import { View } from "react-native";

import { EnableKeyboardScreen } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";

const Screen = () => (
  <EnableKeyboardScreen
    onBack={() => console.log("Back")}
    onSkip={() => console.log("Skip")}
    onGoToSettings={() => console.log("Go to Settings")}
  />
);

export const Default = () => (
  <View style={{ height: 720, borderRadius: 16, overflow: "hidden" }}>
    <Screen />
  </View>
);

export const Landscape = () => (
  <View
    style={{
      width: 720,
      height: 360,
      borderRadius: 16,
      overflow: "hidden",
    }}
  >
    <Screen />
  </View>
);

const gallery: GalleryEntry = {
  slug: "enable-keyboard-screen",
  title: "Enable Keyboard Screen",
  group: "Domain",
  demos: [
    { name: "Default", render: Default },
    { name: "Landscape", render: Landscape },
  ],
};

export default gallery;
