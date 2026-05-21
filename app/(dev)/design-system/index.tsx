import { Link, Stack } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components";
import { Routes } from "@/constants";
import { useTheme } from "@/theme";

import { DESIGN_SYSTEM_MANIFEST, GalleryGroup } from "@/design-system/manifest";

const GROUP_ORDER: GalleryGroup[] = ["UI", "Shared", "Domain"];

const GROUPED_ENTRIES = GROUP_ORDER.map((group) => ({
  group,
  entries: DESIGN_SYSTEM_MANIFEST.filter((entry) => entry.group === group).sort(
    (a, b) => a.title.localeCompare(b.title),
  ),
}));

export default function DesignSystemIndex() {
  const { theme } = useTheme();

  return (
    <>
      <Stack.Screen
        options={{
          title: "Design System",
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.surfaceBackground },
          headerTintColor: theme.colors.textPrimary,
          headerTitleStyle: { color: theme.colors.textPrimary },
        }}
      />
      <ScrollView
        style={{ backgroundColor: theme.colors.surfaceBackground }}
        contentContainerStyle={styles.container}
      >
        {GROUPED_ENTRIES.map(({ group, entries }) => {
          if (entries.length === 0) return null;
          return (
            <View key={group} style={styles.section}>
              <Text
                variant="caption1"
                weight="semibold"
                color={theme.colors.textTertiary}
                style={styles.sectionLabel}
              >
                {group.toUpperCase()}
              </Text>
              <View
                style={[
                  styles.list,
                  { backgroundColor: theme.colors.surfacePrimary },
                ]}
              >
                {entries.map((entry, index) => (
                  <Link
                    key={entry.slug}
                    href={Routes.designSystemDetail(entry.slug)}
                    asChild
                  >
                    <Pressable
                      style={({ pressed }) => [
                        styles.row,
                        index !== entries.length - 1 && {
                          borderBottomColor: theme.colors.surfaceTertiary,
                          borderBottomWidth: StyleSheet.hairlineWidth,
                        },
                        pressed && { opacity: 0.6 },
                      ]}
                    >
                      <Text variant="body1" color={theme.colors.textPrimary}>
                        {entry.title}
                      </Text>
                      <Text
                        variant="caption1"
                        color={theme.colors.textTertiary}
                      >
                        {entry.demos.length}{" "}
                        {entry.demos.length === 1 ? "demo" : "demos"}
                      </Text>
                    </Pressable>
                  </Link>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 24,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    paddingHorizontal: 8,
    letterSpacing: 1,
  },
  list: {
    borderRadius: 12,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
