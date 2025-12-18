import { BlurView } from 'expo-blur';
import { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme';

export interface DimmerProps {
  visible: boolean;
  children?: ReactNode;
  onDismiss: () => void;
}

export const Dimmer = ({ visible, children, onDismiss }: DimmerProps) => {
  const { isDark } = useTheme();

  const overlayColor = isDark
    ? 'rgba(0, 0, 0, 0.04)'
    : 'rgba(255, 255, 255, 0.04)';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.container} onPress={onDismiss}>
        <BlurView
          experimentalBlurMethod="dimezisBlurView"
          intensity={24}
          tint={isDark ? 'light' : 'dark'}
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
