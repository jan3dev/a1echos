import type { Meta } from '@storybook/react-native';
import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components';
import { useTheme } from '@/theme';

import { iconMap, IconName } from './iconMap';


const StoryContainer = ({ children }: { children: ReactNode }) => {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surfaceBackground,
        padding: 16,
      }}
    >
      {children}
    </View>
  );
};

const IconMeta: Meta<typeof Icon> = {
  title: 'UI Components/Icon',
  component: Icon,
  args: {
    size: 24,
    color: '#090A0B',
    name: 'mic',
  },
  argTypes: {
    name: {
      control: 'select',
      options: Object.keys(iconMap).sort(),
    },
    size: {
      control: { type: 'range', min: 16, max: 64, step: 4 },
    },
    color: {
      control: 'color',
    },
  },
  decorators: [
    (Story) => (
      <StoryContainer>
        <Story />
      </StoryContainer>
    ),
  ],
};

export default IconMeta;

export const AllIcons = () => {
  const { theme } = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {Object.keys(iconMap)
        .sort()
        .map((name) => (
          <View key={name} style={styles.iconItem}>
            <Icon
              name={name as IconName}
              size={32}
              color={theme.colors.textPrimary}
            />
            <Text variant="caption2" style={styles.iconLabel}>
              {name}
            </Text>
          </View>
        ))}
    </ScrollView>
  );
};

export const Sizes = () => {
  const { theme } = useTheme();
  const sizes = [16, 24, 32, 48, 64];

  return (
    <View style={styles.container}>
      {sizes.map((size) => (
        <View key={size} style={styles.iconItem}>
          <Icon name="mic" size={size} color={theme.colors.textPrimary} />
          <Text variant="caption2" style={styles.iconLabel}>
            {size}px
          </Text>
        </View>
      ))}
    </View>
  );
};

export const Colors = () => {
  const { theme } = useTheme();
  const colors = [
    { name: 'Black', value: '#090A0B' },
    { name: 'Brand', value: '#4361EE' },
    { name: 'Orange', value: '#F7931A' },
    { name: 'Cyan', value: '#16BAC5' },
    { name: 'White', value: '#FFFFFF' },
  ];

  return (
    <View style={styles.container}>
      {colors.map(({ name, value }) => (
        <View key={name} style={styles.iconItem}>
          <View
            style={[
              styles.colorBackground,
              {
                backgroundColor: theme.colors.surfaceTertiary,
              },
            ]}
          >
            <Icon name="mic" size={32} color={value} />
          </View>
          <Text variant="caption2" style={styles.iconLabel}>
            {name}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconItem: {
    alignItems: 'center',
    gap: 8,
    width: 80,
  },
  iconLabel: {
    textAlign: 'center',
    color: '#4C5357',
  },
  colorBackground: {
    padding: 16,
    borderRadius: 8,
  },
});
