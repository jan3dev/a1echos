import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useTheme } from '../../../theme';
import { Button } from '../../ui/button';
import { Text } from '../../ui/text';

interface IncognitoExplainerModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export const IncognitoExplainerModal = ({
  visible,
  onDismiss,
}: IncognitoExplainerModalProps) => {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: theme.colors.glassBackground },
        ]}
      >
        <View
          style={[
            styles.content,
            { backgroundColor: theme.colors.surfacePrimary },
          ]}
        >
          <Text variant="h5" style={styles.title}>
            Incognito Mode
          </Text>
          <Text variant="body1" style={styles.text}>
            Incognito mode prevents sessions from being saved to your device.
          </Text>
          <Button.primary onPress={onDismiss} text="Got it" />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    padding: 20,
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    gap: 16,
  },
  title: {
    textAlign: 'center',
  },
  text: {
    textAlign: 'center',
  },
});
