import { View } from "react-native";

import { SwitchKeyboardScreen } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";

export const Default = () => (
  <View style={{ height: 720, borderRadius: 16, overflow: "hidden" }}>
    <SwitchKeyboardScreen
      onBack={() => console.log("Back")}
      onSkip={() => console.log("Skip")}
    />
  </View>
);

const gallery: GalleryEntry = {
  slug: "switch-keyboard-screen",
  title: "Switch Keyboard Screen",
  group: "Domain",
  demos: [{ name: "Default", render: Default }],
};

export default gallery;
