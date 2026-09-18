import { View } from "react-native";

import { AllowMicrophoneScreen } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";

export const Default = () => (
  <View style={{ height: 720, borderRadius: 16, overflow: "hidden" }}>
    <AllowMicrophoneScreen
      onBack={() => console.log("Back")}
      onSkip={() => console.log("Skip")}
      onAllow={() => console.log("Allow")}
    />
  </View>
);

const gallery: GalleryEntry = {
  slug: "allow-microphone-screen",
  title: "Allow Microphone Screen",
  group: "Domain",
  demos: [{ name: "Default", render: Default }],
};

export default gallery;
