import { BlurView } from "@sbaiahmed1/react-native-blur";
import { ReactNode } from "react";
import { Modal, Pressable, StyleSheet } from "react-native";

import { useTheme } from "@/theme";

export interface DimmerProps {
  visible: boolean;
  children?: ReactNode;
  onDismiss: () => void;
}

export const Dimmer = ({ visible, children, onDismiss }: DimmerProps) => {
  const { isDark } = useTheme();

  const overlayColor = isDark
    ? "rgba(0, 0, 0, 0.04)"
    : "rgba(255, 255, 255, 0.04)";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
      supportedOrientations={["portrait", "portrait-upside-down", "landscape"]}
    >
      <Pressable style={styles.container} onPress={onDismiss}>
        <BlurView
          blurAmount={20}
          blurRounds={3}
          blurType={isDark ? "dark" : "light"}
          style={styles.blurContainer}
        >
          <Pressable
            style={[styles.overlay, { backgroundColor: overlayColor }]}
            onPress={onDismiss}
          >
            {children}
          </Pressable>
        </BlurView>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  blurContainer: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
});
