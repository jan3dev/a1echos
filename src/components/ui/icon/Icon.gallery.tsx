import { ScrollView, StyleSheet, View } from "react-native";

import { Icon, Text } from "@/components";
import { useTheme } from "@/theme";
import type { GalleryEntry } from "@/design-system/manifest";

import { iconMap, IconName } from "./iconMap";


export const AllIcons = () => {
  const { theme } = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {Object.keys(iconMap)
        .sort()
        .map((name) => (
          <View key={name} style={styles.iconItem}>
            <Icon
              name={name as IconName}
              size={32}
              color={theme.colors.textPrimary}
            />
            <Text variant="caption2" style={styles.iconLabel}>
              {name}
            </Text>
          </View>
        ))}
    </ScrollView>
  );
};

export const Sizes = () => {
  const { theme } = useTheme();
  const sizes = [16, 24, 32, 48, 64];

  return (
    <View style={styles.container}>
      {sizes.map((size) => (
        <View key={size} style={styles.iconItem}>
          <Icon name="mic" size={size} color={theme.colors.textPrimary} />
          <Text variant="caption2" style={styles.iconLabel}>
            {size}px
          </Text>
        </View>
      ))}
    </View>
  );
};

export const Colors = () => {
  const { theme } = useTheme();
  const colors = [
    { name: "Black", value: "#0F1214" },
    { name: "Brand", value: "#4361EE" },
    { name: "Orange", value: "#F7931A" },
    { name: "Cyan", value: "#16BAC5" },
    { name: "White", value: "#FFFFFF" },
  ];

  return (
    <View style={styles.container}>
      {colors.map(({ name, value }) => (
        <View key={name} style={styles.iconItem}>
          <View
            style={[
              styles.colorBackground,
              {
                backgroundColor: theme.colors.surfaceTertiary,
              },
            ]}
          >
            <Icon name="mic" size={32} color={value} />
          </View>
          <Text variant="caption2" style={styles.iconLabel}>
            {name}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    gap: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  iconItem: {
    alignItems: "center",
    gap: 8,
    width: 80,
  },
  iconLabel: {
    textAlign: "center",
    color: "#2C3136",
  },
  colorBackground: {
    padding: 16,
    borderRadius: 8,
  },
});

const gallery: GalleryEntry = {
  slug: "icon",
  title: "Icon",
  group: "UI",
  demos: [
    { name: "AllIcons", render: AllIcons },
    { name: "Sizes", render: Sizes },
    { name: "Colors", render: Colors },
  ],
};

export default gallery;
