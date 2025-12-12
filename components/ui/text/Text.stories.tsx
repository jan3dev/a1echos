import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';

import { Text } from '@/components';
import { useTheme } from '@/theme';

const StoryContainer = ({ children }: { children: React.ReactNode }) => {
  const { theme } = useTheme();
  return (
    <View
      style={{
        padding: 16,
        backgroundColor: theme.colors.surfaceBackground,
        flex: 1,
      }}
    >
      {children}
    </View>
  );
};

const TextMeta: Meta<typeof Text> = {
  title: 'UI Components/Text',
  component: Text,
  args: {
    children: 'The quick brown fox jumps over the lazy dog',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'subtitle',
        'body1',
        'body2',
        'caption1',
        'caption2',
      ],
    },
    weight: {
      control: 'select',
      options: ['regular', 'medium', 'semibold'],
    },
    align: {
      control: 'select',
      options: ['auto', 'left', 'right', 'center', 'justify'],
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

export default TextMeta;

type Story = StoryObj<typeof Text>;

export const Default: Story = {};

export const Variants = () => (
  <View style={{ gap: 16 }}>
    <Text variant="h1">Heading 1</Text>
    <Text variant="h2">Heading 2</Text>
    <Text variant="h3">Heading 3</Text>
    <Text variant="h4">Heading 4</Text>
    <Text variant="h5">Heading 5</Text>
    <Text variant="subtitle">Subtitle</Text>
    <Text variant="body1">Body 1 - Main text content</Text>
    <Text variant="body2">Body 2 - Secondary text content</Text>
    <Text variant="caption1">Caption 1 - Small helper text</Text>
    <Text variant="caption2">Caption 2 - Tiny labels</Text>
  </View>
);

export const Weights = () => (
  <View style={{ gap: 16 }}>
    <Text variant="h3" weight="regular">
      Regular Weight
    </Text>
    <Text variant="h3" weight="medium">
      Medium Weight
    </Text>
    <Text variant="h3" weight="semibold">
      SemiBold Weight
    </Text>
  </View>
);
