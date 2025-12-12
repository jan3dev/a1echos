import { useState } from 'react';
import { Button as RNButton, StyleSheet, View } from 'react-native';

import { Dimmer, Text } from '@/components';
import { useTheme } from '@/theme';

export default {
  title: 'UI Components/Dimmer',
  component: Dimmer,
};

export const Basic = () => {
  const [visible, setVisible] = useState(false);
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceBackground },
      ]}
    >
      <RNButton title="Show Dimmer" onPress={() => setVisible(true)} />
      <Dimmer visible={visible} onDismiss={() => setVisible(false)} />
    </View>
  );
};

export const WithContent = () => {
  const [visible, setVisible] = useState(false);
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceBackground },
      ]}
    >
      <RNButton
        title="Show Dimmer with Content"
        onPress={() => setVisible(true)}
      />
      <Dimmer visible={visible} onDismiss={() => setVisible(false)}>
        <View style={styles.contentContainer}>
          <View
            style={[
              styles.contentBox,
              { backgroundColor: theme.colors.surfacePrimary },
            ]}
          >
            <Text variant="h4" weight="semibold" align="center">
              Custom Content
            </Text>
            <View style={styles.spacing} />
            <Text variant="body1" weight="medium" align="center">
              This is custom content inside the dimmer
            </Text>
            <View style={styles.buttonSpacing} />
            <RNButton title="Close" onPress={() => setVisible(false)} />
          </View>
        </View>
      </Dimmer>
    </View>
  );
};

export const AsOverlay = () => {
  const [visible, setVisible] = useState(false);
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceBackground },
      ]}
    >
      <Text variant="h4" weight="semibold" align="center">
        Background Content
      </Text>
      <View style={styles.spacing} />
      <Text variant="body1" weight="medium" align="center">
        This content will be blurred when dimmer is shown
      </Text>
      <View style={styles.buttonSpacing} />
      <RNButton title="Show Overlay" onPress={() => setVisible(true)} />
      <Dimmer visible={visible} onDismiss={() => setVisible(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  contentBox: {
    borderRadius: 16,
    padding: 24,
    minWidth: 280,
    alignItems: 'center',
  },
  spacing: {
    height: 12,
  },
  buttonSpacing: {
    height: 24,
  },
});
