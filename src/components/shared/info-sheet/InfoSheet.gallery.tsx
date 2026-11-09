import { useState } from "react";
import { Button as RNButton, StyleSheet, View } from "react-native";

import { InfoSheet } from "@/components";
import type { GalleryEntry } from "@/design-system/manifest";

const InfoSheetDemo = ({ message }: { message: string }) => {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.container}>
      <RNButton title="Show Info Sheet" onPress={() => setVisible(true)} />
      <InfoSheet
        visible={visible}
        title="Smart Split"
        message={message}
        onDismiss={() => setVisible(false)}
      />
    </View>
  );
};

export const Default = () => (
  <InfoSheetDemo message="Automatically splits long recordings into separate items at natural pauses." />
);

export const LongText = () => (
  <InfoSheetDemo
    message={Array.from(
      { length: 12 },
      () =>
        "How long voice typing stays ready in the background after you start it from another app.",
    ).join(" ")}
  />
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
});

const gallery: GalleryEntry = {
  slug: "info-sheet",
  title: "Info Sheet",
  group: "Shared",
  demos: [
    { name: "Default", render: Default },
    { name: "LongText", render: LongText },
  ],
};

export default gallery;
