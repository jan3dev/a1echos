import { View } from "react-native";

import { PrivacyScreen } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";

export const Default = () => (
  <View style={{ height: 720, borderRadius: 16, overflow: "hidden" }}>
    <PrivacyScreen
      onBack={() => console.log("Back")}
      onNext={() => console.log("Next")}
    />
  </View>
);

const gallery: GalleryEntry = {
  slug: "privacy-screen",
  title: "Privacy Screen",
  group: "Domain",
  demos: [{ name: "Default", render: Default }],
};

export default gallery;
