import { ReactNode } from "react";
import { Modal, Pressable, StyleSheet } from "react-native";

import { useTheme } from "@/theme";

export interface DimmerProps {
  visible: boolean;
  children?: ReactNode;
  onDismiss: () => void;
}

export const Dimmer = ({ visible, children, onDismiss }: DimmerProps) => {
  const { theme, isDark } = useTheme();

  // Pinned to the original glassBackground-dark opacity (0.7) so the scrim stays
  // dimmer-appropriate while glassBackground is bumped to ~0.88 for headers/panels.
  const scrimColor = isDark
    ? "rgba(9, 10, 11, 0.7)"
    : theme.colors.glassInverse;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
      supportedOrientations={["portrait", "portrait-upside-down", "landscape"]}
    >
      <Pressable
        style={[styles.container, { backgroundColor: scrimColor }]}
        onPress={onDismiss}
      >
        {children}
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
