import { useState } from "react";
import { Button as RNButton, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme";
import type { GalleryEntry } from "@/design-system/manifest";

import { SUB_SCREEN_NAVBAR_HEIGHT, SubScreenNavbar } from "./SubScreenNavbar";


const Stage = ({ children }: { children: React.ReactNode }) => {
  const { bottom: bottomInset } = useSafeAreaInsets();
  return (
    <View
      style={[styles.stage, { height: SUB_SCREEN_NAVBAR_HEIGHT + bottomInset }]}
    >
      {children}
    </View>
  );
};

const DefaultDemo = () => {
  const { theme } = useTheme();
  return (
    <Stage>
      <SubScreenNavbar
        visible
        actions={[
          {
            key: "rename",
            icon: "edit",
            label: "Rename",
            onPress: () => console.log("rename"),
          },
          {
            key: "delete",
            icon: "trash",
            label: "Delete",
            color: theme.colors.accentDanger,
            onPress: () => console.log("delete"),
          },
        ]}
      />
    </Stage>
  );
};

const WithDisabledDemo = () => {
  const { theme } = useTheme();
  return (
    <Stage>
      <SubScreenNavbar
        visible
        actions={[
          {
            key: "rename",
            icon: "edit",
            label: "Rename",
            disabled: true,
            onPress: () => console.log("rename"),
          },
          {
            key: "delete",
            icon: "trash",
            label: "Delete",
            color: theme.colors.accentDanger,
            onPress: () => console.log("delete"),
          },
        ]}
      />
    </Stage>
  );
};

const HiddenDemo = () => {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);
  return (
    <Stage>
      <View style={styles.button}>
        <RNButton
          title={visible ? "Hide" : "Show"}
          onPress={() => setVisible((v) => !v)}
        />
      </View>
      <SubScreenNavbar
        visible={visible}
        actions={[
          {
            key: "rename",
            icon: "edit",
            label: "Rename",
            onPress: () => console.log("rename"),
          },
          {
            key: "delete",
            icon: "trash",
            label: "Delete",
            color: theme.colors.accentDanger,
            onPress: () => console.log("delete"),
          },
        ]}
      />
    </Stage>
  );
};

const DangerOnlyDemo = () => {
  const { theme } = useTheme();
  return (
    <Stage>
      <SubScreenNavbar
        visible
        actions={[
          {
            key: "delete",
            icon: "trash",
            label: "Delete",
            color: theme.colors.accentDanger,
            onPress: () => console.log("delete"),
          },
        ]}
      />
    </Stage>
  );
};

const styles = StyleSheet.create({
  stage: {
    width: "100%",
    overflow: "hidden",
  },
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

const gallery: GalleryEntry = {
  slug: "sub-screen-navbar",
  title: "Sub-Screen Navbar",
  group: "UI",
  demos: [
    { name: "Default", render: DefaultDemo },
    { name: "WithDisabled", render: WithDisabledDemo },
    { name: "Hidden", render: HiddenDemo },
    { name: "DangerOnly", render: DangerOnlyDemo },
  ],
};

export default gallery;
