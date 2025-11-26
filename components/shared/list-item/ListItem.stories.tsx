import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View } from 'react-native';
import { Icon } from '../../ui/icon/Icon';
import { Text } from '../../ui/text/Text';
import { ListItem } from './ListItem';

const meta = {
  title: 'Shared Components/ListItem',
  component: ListItem,
  decorators: [
    (Story) => (
      <View style={{ padding: 16, flex: 1, backgroundColor: '#F4F5F6' }}>
        <Story />
      </View>
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

export const WithLeadingIcon: Story = {
  args: {
    title: 'Security',
    subtitle: 'Manage your security settings',
    iconLeading: 'shield',
    onPress: () => console.log('Pressed'),
  },
  argTypes: {
    iconLeading: {
      options: ['shield', 'none'],
      mapping: {
        shield: <Icon name="shield" size={24} color="#4361EE" />,
        none: null,
      },
    },
  },
};

export const WithTrailingIcon: Story = {
  args: {
    title: 'Language',
    subtitle: 'English',
    iconLeading: 'language',
    iconTrailing: 'chevron_right',
    onPress: () => console.log('Pressed'),
  },
  argTypes: {
    iconLeading: {
      options: ['language', 'none'],
      mapping: {
        language: <Icon name="language" size={24} />,
        none: null,
      },
    },
    iconTrailing: {
      options: ['chevron_right', 'none'],
      mapping: {
        chevron_right: <Icon name="chevron_right" size={20} color="#929BA0" />,
        none: null,
      },
    },
  },
};

export const WithTrailingText: Story = {
  args: {
    title: 'Bitcoin',
    subtitle: 'BTC',
    titleTrailing: '$45,230.50',
    subtitleTrailing: '+2.5%',
    subtitleTrailingColor: '#18A23B',
    iconLeading: 'bitcoin_generic',
    onPress: () => console.log('Pressed'),
  },
  argTypes: {
    iconLeading: {
      options: ['bitcoin_generic', 'none'],
      mapping: {
        bitcoin_generic: (
          <Icon name="bitcoin_generic" size={32} color="#F7931A" />
        ),
        none: null,
      },
    },
  },
};

export const Selected: Story = {
  args: {
    title: 'Selected Item',
    subtitle: 'This item is currently selected',
    selected: true,
    iconLeading: 'check_circle',
    onPress: () => console.log('Pressed'),
  },
  argTypes: {
    iconLeading: {
      options: ['check_circle', 'none'],
      mapping: {
        check_circle: <Icon name="check_circle" size={24} color="#4361EE" />,
        none: null,
      },
    },
  },
};

export const WithCustomContent: Story = {
  args: {
    title: 'Custom Content',
    contentWidget: 'custom',
    iconLeading: 'warning',
    onPress: () => console.log('Pressed'),
  },
  argTypes: {
    contentWidget: {
      options: ['custom', 'none'],
      mapping: {
        custom: (
          <View style={{ flexDirection: 'row', marginTop: 4 }}>
            <View
              style={{
                backgroundColor: '#FFE5E5',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 4,
                marginRight: 8,
              }}
            >
              <Text variant="caption1" color="#FF3B13">
                High Risk
              </Text>
            </View>
            <Text variant="caption1" color="#929BA0">
              Manual review required
            </Text>
          </View>
        ),
        none: null,
      },
    },
    iconLeading: {
      options: ['warning', 'none'],
      mapping: {
        warning: <Icon name="warning" size={24} color="#FF3B13" />,
        none: null,
      },
    },
  },
};
