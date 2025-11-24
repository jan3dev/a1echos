import type { Meta, StoryObj } from '@storybook/react-native';
import React from 'react';
import { ImageBackground, View } from 'react-native';
import { Text } from '../text/Text';
import { Surface } from './Surface';

const SurfaceMeta: Meta<typeof Surface> = {
  title: 'Foundation/Surface',
  component: Surface,
  args: {
    padding: 16,
    children: 'Surface Content',
  },
  argTypes: {
    variant: {
      control: 'radio',
      options: ['filled', 'glass'],
    },
    elevation: {
      control: { type: 'range', min: 0, max: 24, step: 1 },
    },
  },
  decorators: [
    (Story) => (
      <View
        style={{
          flex: 1,
          padding: 32,
          justifyContent: 'center',
          backgroundColor: '#E9EBEC',
        }}
      >
        <Story />
      </View>
    ),
  ],
};

export default SurfaceMeta;

type Story = StoryObj<typeof Surface>;

export const Default: Story = {
  render: (args) => (
    <Surface {...args}>
      <Text>{args.children}</Text>
    </Surface>
  ),
};

export const Elevations = () => (
  <View style={{ gap: 24 }}>
    <Surface elevation={0} padding={16}>
      <Text>Elevation 0 (Flat)</Text>
    </Surface>
    <Surface elevation={2} padding={16}>
      <Text>Elevation 2 (Small)</Text>
    </Surface>
    <Surface elevation={4} padding={16}>
      <Text>Elevation 4 (Medium)</Text>
    </Surface>
    <Surface elevation={8} padding={16}>
      <Text>Elevation 8 (Large)</Text>
    </Surface>
  </View>
);

export const GlassEffect: Story = {
  render: () => (
    <ImageBackground
      source={{ uri: 'https://picsum.photos/800/600' }}
      style={{ flex: 1, padding: 32, justifyContent: 'center', gap: 24 }}
    >
      <Surface variant="glass" padding={24} borderRadius={16}>
        <Text weight="semibold" style={{ color: '#000' }}>
          Glass Surface
        </Text>
        <Text variant="caption1" style={{ color: '#000', marginTop: 4 }}>
          Blur effect over background
        </Text>
      </Surface>

      <Surface
        variant="glass"
        padding={24}
        borderRadius={16}
        color="rgba(0,0,0,0.4)"
      >
        <Text weight="semibold" style={{ color: '#fff' }}>
          Dark Glass
        </Text>
        <Text variant="caption1" style={{ color: '#fff', marginTop: 4 }}>
          With custom dark tint
        </Text>
      </Surface>
    </ImageBackground>
  ),
};
