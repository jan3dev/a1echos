import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components";
import { findGalleryBySlug } from "@/design-system/manifest";
import { useTheme } from "@/theme";

export default function DesignSystemDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const entry = slug ? findGalleryBySlug(slug) : undefined;
  const { theme } = useTheme();

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

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.surfaceBackground }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen
        options={{
          title: entry.title,
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.surfaceBackground },
          headerTintColor: theme.colors.textPrimary,
          headerTitleStyle: { color: theme.colors.textPrimary },
        }}
      />
      {entry.demos.map((demo) => (
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
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
