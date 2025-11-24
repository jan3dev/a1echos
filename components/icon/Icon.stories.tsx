import type { Meta } from '@storybook/react-native';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../text/Text';
import { Icon } from './Icon';
import { iconMap, IconName } from './iconMap';

const IconMeta: Meta<typeof Icon> = {
  title: 'Foundation/Icon',
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
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F4F5F6',
          padding: 16,
        }}
      >
        <Story />
      </View>
    ),
  ],
};

export default IconMeta;

export const AllIcons = () => {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {Object.keys(iconMap)
        .sort()
        .map((name) => (
          <View key={name} style={styles.iconItem}>
            <Icon name={name as IconName} size={32} color="#090A0B" />
            <Text variant="caption2" style={styles.iconLabel}>
              {name}
            </Text>
          </View>
        ))}
    </ScrollView>
  );
};

export const Sizes = () => {
  const sizes = [16, 24, 32, 48, 64];

  return (
    <View style={styles.container}>
      {sizes.map((size) => (
        <View key={size} style={styles.iconItem}>
          <Icon name="mic" size={size} color="#090A0B" />
          <Text variant="caption2" style={styles.iconLabel}>
            {size}px
          </Text>
        </View>
      ))}
    </View>
  );
};

export const Colors = () => {
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
              { backgroundColor: value === '#FFFFFF' ? '#27292C' : '#E9EBEC' },
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
