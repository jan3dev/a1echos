import type { Meta, StoryObj } from '@storybook/react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon, IconName } from './Icon';

const IconMeta: Meta<typeof Icon> = {
  title: 'Foundation/Icon',
  component: Icon,
  argTypes: {
    name: {
      control: 'select',
      options: ['mic', 'rectangle', 'lock', 'chevron-up', 'settings'],
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
        }}
      >
        <Story />
      </View>
    ),
  ],
};

export default IconMeta;

type Story = StoryObj<typeof Icon>;

export const Microphone: Story = {
  args: {
    name: 'mic',
    size: 24,
    color: '#090A0B',
  },
};

export const Rectangle: Story = {
  args: {
    name: 'rectangle',
    size: 24,
    color: '#090A0B',
  },
};

export const Lock: Story = {
  args: {
    name: 'lock',
    size: 24,
    color: '#090A0B',
  },
};

export const ChevronUp: Story = {
  args: {
    name: 'chevron-up',
    size: 24,
    color: '#090A0B',
  },
};

export const Settings: Story = {
  args: {
    name: 'settings',
    size: 24,
    color: '#090A0B',
  },
};

export const AllIcons = () => {
  const iconNames: IconName[] = ['mic', 'rectangle', 'lock', 'chevron-up', 'settings'];

  return (
    <View style={styles.container}>
      {iconNames.map((name) => (
        <View key={name} style={styles.iconItem}>
          <Icon name={name} size={32} color="#090A0B" />
          <Text style={styles.iconLabel}>{name}</Text>
        </View>
      ))}
    </View>
  );
};

export const Sizes = () => {
  const sizes = [16, 24, 32, 48, 64];

  return (
    <View style={styles.container}>
      {sizes.map((size) => (
        <View key={size} style={styles.iconItem}>
          <Icon name="mic" size={size} color="#090A0B" />
          <Text style={styles.iconLabel}>{size}px</Text>
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
              { backgroundColor: name === 'White' ? '#27292C' : '#F4F5F6' },
            ]}
          >
            <Icon name="mic" size={32} color={value} />
          </View>
          <Text style={styles.iconLabel}>{name}</Text>
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
  },
  iconLabel: {
    fontSize: 12,
    color: '#4C5357',
  },
  colorBackground: {
    padding: 16,
    borderRadius: 8,
  },
});

