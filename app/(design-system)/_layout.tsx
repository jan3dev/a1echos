import { Stack } from "expo-router";

import { useTheme } from "@/theme";

export default function DesignSystemLayout() {
  const { theme } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surfaceBackground },
        headerTintColor: theme.colors.textPrimary,
        headerTitleStyle: { color: theme.colors.textPrimary },
        contentStyle: { backgroundColor: theme.colors.surfaceBackground },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Design System" }} />
      <Stack.Screen name="[slug]" options={{ title: "" }} />
    </Stack>
  );
}
