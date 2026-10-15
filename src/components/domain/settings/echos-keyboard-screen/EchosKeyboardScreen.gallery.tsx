import { View } from "react-native";

import { EchosKeyboardScreen } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";

export const Default = () => (
  <View style={{ height: 720, borderRadius: 16, overflow: "hidden" }}>
    <EchosKeyboardScreen
      onClose={() => console.log("Close")}
      onAddKeyboard={() => console.log("Add Keyboard")}
    />
  </View>
);

const gallery: GalleryEntry = {
  slug: "echos-keyboard-screen",
  title: "Echos Keyboard Screen",
  group: "Domain",
  demos: [{ name: "Default", render: Default }],
};

export default gallery;
