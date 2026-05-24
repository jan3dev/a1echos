import { ReactNode } from "react";
import { AccessibilityState, Pressable, StyleSheet } from "react-native";

import { useTheme } from "@/theme";
import { iosPressed } from "@/utils";

export interface GlassIconButtonProps {
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityState?: AccessibilityState;
  testID?: string;
  children: ReactNode;
}

export const GlassIconButton = ({
  onPress,
  accessibilityLabel,
  accessibilityState,
  testID,
  children,
}: GlassIconButtonProps) => {
  const { theme, isDark } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      hitSlop={6}
      android_ripple={{
        color: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
        borderless: true,
        radius: 20,
      }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: theme.colors.glassSurface,
          opacity: iosPressed(pressed),
        },
      ]}
    >
      {children}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
