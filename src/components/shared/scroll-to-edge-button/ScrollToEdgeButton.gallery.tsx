import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import type { GalleryEntry } from "@/design-system/manifest";

import { ScrollToEdgeButton } from "./ScrollToEdgeButton";

const Container = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.container}>{children}</View>
);

export const Down = () => (
  <Container>
    <ScrollToEdgeButton
      visible
      direction="down"
      onPress={() => {}}
      accessibilityLabel="Scroll to latest"
    />
  </Container>
);

export const Up = () => (
  <Container>
    <ScrollToEdgeButton
      visible
      direction="up"
      onPress={() => {}}
      accessibilityLabel="Scroll to top"
    />
  </Container>
);

export const Toggling = () => {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setVisible((v) => !v), 1200);
    return () => clearInterval(id);
  }, []);
  return (
    <Container>
      <ScrollToEdgeButton
        visible={visible}
        direction="down"
        onPress={() => {}}
        accessibilityLabel="Scroll to latest"
      />
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 16,
    padding: 16,
  },
});

const gallery: GalleryEntry = {
  slug: "scroll-to-edge-button",
  title: "Scroll To Edge Button",
  group: "Shared",
  demos: [
    { name: "Down", render: Down },
    { name: "Up", render: Up },
    { name: "Toggling", render: Toggling },
  ],
};

export default gallery;
