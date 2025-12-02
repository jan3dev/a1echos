import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../../theme/useTheme';
import { Icon } from '../icon/Icon';
import { TopAppBar } from './TopAppBar';

const StoryContainer = ({ children }: { children: React.ReactNode }) => {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.surfaceBackground,
      }}
    >
      {children}
    </View>
  );
};

const meta = {
  title: 'UI Components/TopAppBar',
  component: TopAppBar,
  decorators: [
    (Story) => (
      <StoryContainer>
        <Story />
      </StoryContainer>
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

const WithActionsContent = () => {
  const { theme } = useTheme();
  return (
    <TopAppBar
      title="Details"
      showBackButton={true}
      actions={[
        <Icon
          key="1"
          name="search"
          size={24}
          color={theme.colors.textPrimary}
        />,
        <Icon key="2" name="more" size={24} color={theme.colors.textPrimary} />,
      ]}
    />
  );
};

export const WithActions: Story = {
  render: () => <WithActionsContent />,
};

const WithCustomLeadingContent = () => {
  const { theme } = useTheme();
  return (
    <TopAppBar
      title="Custom Leading"
      showBackButton={false}
      leading={<Icon name="close" size={24} color={theme.colors.textPrimary} />}
    />
  );
};

export const WithCustomLeading: Story = {
  render: () => <WithCustomLeadingContent />,
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

const LongTitleContent = () => {
  const { theme } = useTheme();
  return (
    <TopAppBar
      title="Very Long Page Title That Should Truncate Or Handle Gracefully"
      showBackButton={true}
      actions={[
        <Icon key="1" name="more" size={24} color={theme.colors.textPrimary} />,
      ]}
    />
  );
};

export const LongTitle: Story = {
  render: () => <LongTitleContent />,
};
