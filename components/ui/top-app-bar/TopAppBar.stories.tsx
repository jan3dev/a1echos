import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View } from 'react-native';
import { Icon } from '../icon/Icon';
import { TopAppBar } from './TopAppBar';

const meta = {
  title: 'UI Components/TopAppBar',
  component: TopAppBar,
  decorators: [
    (Story) => (
      <View style={{ flex: 1, backgroundColor: '#F4F5F6' }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof TopAppBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Page Title',
    showBackButton: true,
  },
};

export const WithoutBackButton: Story = {
  args: {
    title: 'Home',
    showBackButton: false,
  },
};

export const WithActions: Story = {
  args: {
    title: 'Details',
    showBackButton: true,
    // actions: [
    //   <Icon key="1" name="search" size={24} />,
    //   <Icon key="2" name="more" size={24} />,
    // ],
  },
  argTypes: {
    actions: {
      options: ['default_actions', 'none'],
      mapping: {
        default_actions: [
          <Icon key="1" name="search" size={24} />,
          <Icon key="2" name="more" size={24} />,
        ],
        none: [],
      },
    },
  },
};

export const WithCustomLeading: Story = {
  args: {
    title: 'Custom Leading',
    showBackButton: false,
    leading: 'close',
  },
  argTypes: {
    leading: {
      options: ['close', 'none'],
      mapping: {
        close: <Icon name="close" size={24} />,
        none: null,
      },
    },
  },
};

export const Transparent: Story = {
  args: {
    title: 'Transparent Bar',
    transparent: true,
    showBackButton: true,
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <View style={{ flex: 1, backgroundColor: '#333' }}>
        <Story />
      </View>
    ),
  ],
};

export const LongTitle: Story = {
  args: {
    title: 'Very Long Page Title That Should Truncate Or Handle Gracefully',
    showBackButton: true,
    // actions: [<Icon key="1" name="more" size={24} />],
  },
  argTypes: {
    actions: {
      options: ['more', 'none'],
      mapping: {
        more: [<Icon key="1" name="more" size={24} />],
        none: [],
      },
    },
  },
};
