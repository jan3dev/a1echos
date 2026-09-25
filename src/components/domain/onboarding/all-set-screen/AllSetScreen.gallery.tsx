import { View } from "react-native";

import { AllSetScreen } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";

export const Default = () => (
  <View style={{ height: 720, borderRadius: 16, overflow: "hidden" }}>
    <AllSetScreen
      onBack={() => console.log("Back")}
      onGetStarted={() => console.log("Get Started")}
    />
  </View>
);

const gallery: GalleryEntry = {
  slug: "all-set-screen",
  title: "All Set Screen",
  group: "Domain",
  demos: [{ name: "Default", render: Default }],
};

export default gallery;
