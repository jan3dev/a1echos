import { View } from "react-native";

import { AutocorrectScreen } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";

export const Default = () => (
  <View style={{ height: 720, borderRadius: 16, overflow: "hidden" }}>
    <AutocorrectScreen
      onBack={() => console.log("Back")}
      onSkip={() => console.log("Skip")}
      onNext={() => console.log("Next")}
    />
  </View>
);

const gallery: GalleryEntry = {
  slug: "autocorrect-screen",
  title: "Autocorrect Screen",
  group: "Domain",
  demos: [{ name: "Default", render: Default }],
};

export default gallery;
