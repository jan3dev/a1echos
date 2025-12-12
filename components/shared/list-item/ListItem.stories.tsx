import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';

import { Icon, ListItem, Text } from '@/components';
import { useTheme } from '@/theme';

const StoryContainer = ({ children }: { children: React.ReactNode }) => {
  const { theme } = useTheme();
  return (
    <View
      style={{
        padding: 16,
        flex: 1,
        backgroundColor: theme.colors.surfaceBackground,
      }}
    >
      {children}
    </View>
  );
};

const meta = {
  title: 'Shared Components/ListItem',
  component: ListItem,
  decorators: [
    (Story) => (
      <StoryContainer>
        <Story />
      </StoryContainer>
    ),
  ],
} satisfies Meta<typeof ListItem>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'List Item Title',
    onPress: () => console.log('Pressed'),
  },
};

export const WithSubtitle: Story = {
  args: {
    title: 'Transaction Sent',
    subtitle: 'Yesterday, 10:30 AM',
    onPress: () => console.log('Pressed'),
  },
};

const WithLeadingIconContent = () => {
  const { theme } = useTheme();
  return (
    <ListItem
      title="Security"
      subtitle="Manage your security settings"
      iconLeading={
        <Icon name="shield" size={24} color={theme.colors.accentBrand} />
      }
      onPress={() => console.log('Pressed')}
    />
  );
};

export const WithLeadingIcon: Story = {
  args: {
    title: 'Security',
  },
  render: () => <WithLeadingIconContent />,
};

const WithTrailingIconContent = () => {
  const { theme } = useTheme();
  return (
    <ListItem
      title="Language"
      subtitle="English"
      iconLeading={
        <Icon name="language" size={24} color={theme.colors.textPrimary} />
      }
      iconTrailing={
        <Icon
          name="chevron_right"
          size={20}
          color={theme.colors.textSecondary}
        />
      }
      onPress={() => console.log('Pressed')}
    />
  );
};

export const WithTrailingIcon: Story = {
  args: {
    title: 'Language',
  },
  render: () => <WithTrailingIconContent />,
};

const WithTrailingTextContent = () => {
  const { theme } = useTheme();
  return (
    <ListItem
      title="Bitcoin"
      subtitle="BTC"
      titleTrailing="$45,230.50"
      subtitleTrailing="+2.5%"
      subtitleTrailingColor={theme.colors.accentSuccess}
      iconLeading={<Icon name="bitcoin_generic" size={32} color="#F7931A" />}
      onPress={() => console.log('Pressed')}
    />
  );
};

export const WithTrailingText: Story = {
  args: {
    title: 'Bitcoin',
  },
  render: () => <WithTrailingTextContent />,
};

const SelectedContent = () => {
  const { theme } = useTheme();
  return (
    <ListItem
      title="Selected Item"
      subtitle="This item is currently selected"
      selected={true}
      iconLeading={
        <Icon name="check_circle" size={24} color={theme.colors.accentBrand} />
      }
      onPress={() => console.log('Pressed')}
    />
  );
};

export const Selected: Story = {
  args: {
    title: 'Selected Item',
  },
  render: () => <SelectedContent />,
};

const WithCustomContentContent = () => {
  const { theme } = useTheme();
  return (
    <ListItem
      title="Custom Content"
      iconLeading={
        <Icon name="warning" size={24} color={theme.colors.accentDanger} />
      }
      onPress={() => console.log('Pressed')}
      contentWidget={
        <View style={{ flexDirection: 'row', marginTop: 4 }}>
          <View
            style={{
              backgroundColor: theme.colors.chipErrorBackgroundColor,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 4,
              marginRight: 8,
            }}
          >
            <Text
              variant="caption1"
              style={{ color: theme.colors.chipErrorForegroundColor }}
            >
              High Risk
            </Text>
          </View>
          <Text
            variant="caption1"
            style={{ color: theme.colors.textSecondary }}
          >
            Manual review required
          </Text>
        </View>
      }
    />
  );
};

export const WithCustomContent: Story = {
  args: {
    title: 'Custom Content',
  },
  render: () => <WithCustomContentContent />,
};
