import type { Meta, StoryObj } from '@storybook/react-native';
import React from 'react';
import { View } from 'react-native';
import { Text } from '../text/Text';
import { Divider } from './Divider';

const DividerMeta: Meta<typeof Divider> = {
  title: 'UI Components/Divider',
  component: Divider,
  args: {
    height: 1,
  },
  decorators: [
    (Story) => (
      <View style={{ padding: 16, width: '100%' }}>
        <Text style={{ marginBottom: 8 }}>Content Above</Text>
        <Story />
        <Text style={{ marginTop: 8 }}>Content Below</Text>
      </View>
    ),
  ],
};

export default DividerMeta;

type Story = StoryObj<typeof Divider>;

export const Default: Story = {};

export const CustomHeight: Story = {
  args: {
    height: 4,
  },
};

export const CustomColor: Story = {
  args: {
    color: '#FF3B13', // Scarlet500
    height: 2,
  },
};
