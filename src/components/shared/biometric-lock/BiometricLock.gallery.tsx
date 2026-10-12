import { View } from "react-native";

import { BiometricLockView } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";

const Demo = ({ showUnlock }: { showUnlock: boolean }) => (
  <View style={{ height: 640 }}>
    <BiometricLockView
      showUnlock={showUnlock}
      onUnlock={() => console.log("Unlock pressed")}
    />
  </View>
);

export const Locked = () => <Demo showUnlock={false} />;
export const AuthFailed = () => <Demo showUnlock />;

const gallery: GalleryEntry = {
  slug: "biometric-lock",
  title: "Biometric Lock",
  group: "Shared",
  demos: [
    { name: "Locked", render: Locked },
    { name: "Auth Failed", render: AuthFailed },
  ],
};

export default gallery;
