import { View } from "react-native";

import { AllowMicrophoneScreen } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";

const Screen = () => (
  <AllowMicrophoneScreen
    onBack={() => console.log("Back")}
    onSkip={() => console.log("Skip")}
    onAllow={() => console.log("Allow")}
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
  slug: "allow-microphone-screen",
  title: "Allow Microphone Screen",
  group: "Domain",
  demos: [
    { name: "Default", render: Default },
    { name: "Landscape", render: Landscape },
  ],
};

export default gallery;
