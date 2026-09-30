import { Asset } from "expo-asset";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import type { GalleryEntry } from "@/design-system/manifest";

import { AudioPlayer } from "./AudioPlayer";

const useSampleUri = () => {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    Asset.fromModule(require("@/assets/sounds/download-complete.wav"))
      .downloadAsync()
      .then((asset) => setUri(asset.localUri));
  }, []);
  return uri;
};

const DefaultDemo = () => (
  <View style={styles.stage}>
    <AudioPlayer uri={useSampleUri()} onDelete={() => console.log("delete")} />
  </View>
);

const LoadingDemo = () => (
  <View style={styles.stage}>
    <AudioPlayer uri={null} onDelete={() => console.log("delete")} />
  </View>
);

const styles = StyleSheet.create({
  stage: {
    width: "100%",
    padding: 16,
  },
});

const gallery: GalleryEntry = {
  slug: "audio-player",
  title: "Audio Player",
  group: "UI",
  demos: [
    { name: "Default", render: DefaultDemo },
    { name: "Loading", render: LoadingDemo },
  ],
};

export default gallery;
