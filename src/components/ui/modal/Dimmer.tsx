import { BlurView } from "expo-blur";
import { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { WindowBlurView } from "@modules/echos-window-blur/src";
import { useTheme } from "@/theme";

export interface DimmerProps {
  visible: boolean;
  children?: ReactNode;
  onDismiss: () => void;
  onShow?: () => void;
}

// Figma "Dimmer" (DS 7:4415): backdrop-blur 100 + Glass/Dimmer. iOS blur
// materials wash a plain page out to white at full intensity, hiding the
// sheet edge, so intensity is tuned on device instead of matching Figma.
const DIMMER_BLUR_INTENSITY = 30;
const ANDROID_WINDOW_BLUR_RADIUS_DP = 30;

/**
 * Full-screen blurred, tinted backdrop for overlays. Must render inside a
 * Modal: on Android expo-blur can't reach content in another window, so the
 * Modal's window blurs what's behind it (Android 12+, else just the tint).
 */
export const DimmerBackdrop = ({ blurred = true }: { blurred?: boolean }) => {
  const { isDark, theme } = useTheme();

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {WindowBlurView && (
        <WindowBlurView
          style={StyleSheet.absoluteFill}
          radius={blurred ? ANDROID_WINDOW_BLUR_RADIUS_DP : 0}
        />
      )}
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

export const Dimmer = ({
  visible,
  children,
  onDismiss,
  onShow,
}: DimmerProps) => (
  <Modal
    visible={visible}
    onShow={onShow}
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
