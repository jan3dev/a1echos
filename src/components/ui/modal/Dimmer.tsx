import { BlurView } from "expo-blur";
import { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "@/theme";

export interface DimmerProps {
  visible: boolean;
  children?: ReactNode;
  onDismiss: () => void;
}

// Figma "Dimmer" (Echos Flows 1107:7636): backdrop-blur 75 + Glass/Background
// at 40%. expo-blur caps well below a 75px radius, so intensity is maxed.
const DIMMER_BLUR_INTENSITY = 100;
const DIMMER_TINT_DARK = "rgba(7, 7, 8, 0.4)";
const DIMMER_TINT_LIGHT = "rgba(245, 245, 248, 0.4)";

/**
 * Full-screen blurred, tinted backdrop for overlays. Android blur needs a
 * `BlurTargetView`, which a Modal can't reach, so it falls back to the tint.
 */
export const DimmerBackdrop = () => {
  const { isDark } = useTheme();

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
          { backgroundColor: isDark ? DIMMER_TINT_DARK : DIMMER_TINT_LIGHT },
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
