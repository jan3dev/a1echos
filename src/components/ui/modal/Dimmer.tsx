import { BlurView } from "expo-blur";
import { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "@/theme";

export interface DimmerProps {
  visible: boolean;
  children?: ReactNode;
  onDismiss: () => void;
}

// Figma "Dimmer" (DS 7:4415): backdrop-blur 100 + Glass/Dimmer. iOS blur
// materials wash a plain page out to white at full intensity, hiding the
// sheet edge, so intensity is tuned on device instead of matching Figma.
const DIMMER_BLUR_INTENSITY = 30;

/**
 * Full-screen blurred, tinted backdrop for overlays. Android blur needs a
 * `BlurTargetView`, which a Modal can't reach, so it falls back to the tint.
 */
export const DimmerBackdrop = () => {
  const { isDark, theme } = useTheme();

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <BlurView
        style={StyleSheet.absoluteFill}
        intensity={DIMMER_BLUR_INTENSITY}
        tint={isDark ? "dark" : "light"}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: theme.colors.glassDimmer },
        ]}
      />
    </View>
  );
};

export const Dimmer = ({ visible, children, onDismiss }: DimmerProps) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onDismiss}
    statusBarTranslucent
    supportedOrientations={["portrait", "portrait-upside-down", "landscape"]}
  >
    <Pressable style={styles.container} onPress={onDismiss}>
      <DimmerBackdrop />
      {children}
    </Pressable>
  </Modal>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
