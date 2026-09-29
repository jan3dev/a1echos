import { View } from "react-native";

import { BiometricLockView } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";

export const Locked = () => (
  <View style={{ height: 480 }}>
    <BiometricLockView onUnlock={() => console.log("Unlock pressed")} />
  </View>
);

const gallery: GalleryEntry = {
  slug: "biometric-lock",
  title: "Biometric Lock",
  group: "Shared",
  demos: [{ name: "Locked", render: Locked }],
};

export default gallery;
