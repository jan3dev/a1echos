import { Stack, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components";
import type { GalleryDemo } from "@/design-system/manifest";
import { findGalleryBySlug } from "@/design-system/manifest";
import { useTheme } from "@/theme";

export default function DesignSystemDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const entry = slug ? findGalleryBySlug(slug) : undefined;
  const { theme } = useTheme();

  const renderDemo = (demo: GalleryDemo): ReactNode => (
    <View key={demo.name} style={styles.demo}>
      <Text
        variant="caption1"
        weight="semibold"
        color={theme.colors.textTertiary}
        style={styles.demoLabel}
      >
        {demo.name.toUpperCase()}
      </Text>
      <View
        style={[
          styles.demoBody,
          { backgroundColor: theme.colors.surfaceSecondary },
        ]}
      >
        {demo.render()}
      </View>
    </View>
  );

  if (!entry) {
    return (
      <View
        style={[
          styles.empty,
          { backgroundColor: theme.colors.surfaceBackground },
        ]}
      >
        <Stack.Screen
          options={{
            title: "Not found",
            headerShown: true,
            headerStyle: { backgroundColor: theme.colors.surfaceBackground },
            headerTintColor: theme.colors.textPrimary,
          }}
        />
        <Text variant="body1" color={theme.colors.textSecondary}>
          {`No gallery for slug "${slug}".`}
        </Text>
      </View>
    );
  }

  const screen = (
    <Stack.Screen
      options={{
        title: entry.title,
        headerShown: true,
        headerStyle: { backgroundColor: theme.colors.surfaceBackground },
        headerTintColor: theme.colors.textPrimary,
        headerTitleStyle: { color: theme.colors.textPrimary },
      }}
    />
  );

  // Demos that render their own VirtualizedList must live outside the page
  // ScrollView, or React Native warns about same-orientation nesting. Pin those
  // at the top in fixed-height frames and scroll the rest below them.
  const selfScrolling = entry.demos.filter((d) => d.selfScrolling);
  const scrollable = entry.demos.filter((d) => !d.selfScrolling);

  if (selfScrolling.length === 0) {
    return (
      <ScrollView
        style={{ backgroundColor: theme.colors.surfaceBackground }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {screen}
        {entry.demos.map(renderDemo)}
      </ScrollView>
    );
  }

  return (
    <View
      style={[styles.page, { backgroundColor: theme.colors.surfaceBackground }]}
    >
      {screen}
      <View style={styles.pinned}>{selfScrolling.map(renderDemo)}</View>
      {scrollable.length > 0 && (
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {scrollable.map(renderDemo)}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  pinned: {
    padding: 16,
    paddingBottom: 0,
    gap: 24,
  },
  container: {
    padding: 16,
    gap: 24,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  demo: {
    gap: 8,
  },
  demoLabel: {
    paddingHorizontal: 8,
    letterSpacing: 1,
  },
  demoBody: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
});
