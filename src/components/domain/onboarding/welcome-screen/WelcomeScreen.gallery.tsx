import { View } from "react-native";

import { WelcomeScreen } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";

export const Default = () => (
  <View style={{ height: 640, borderRadius: 16, overflow: "hidden" }}>
    <WelcomeScreen onGetStarted={() => console.log("Get Started pressed")} />
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
    <WelcomeScreen onGetStarted={() => console.log("Get Started pressed")} />
  </View>
);

const gallery: GalleryEntry = {
  slug: "welcome-screen",
  title: "Welcome Screen",
  group: "Domain",
  demos: [
    { name: "Default", render: Default },
    { name: "Landscape", render: Landscape },
  ],
};

export default gallery;
