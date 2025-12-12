import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';

import { Divider, Text } from '@/components';
import { useTheme } from '@/theme';

const StoryContainer = ({ children }: { children: React.ReactNode }) => {
  const { theme } = useTheme();
  return (
    <View
      style={{
        padding: 16,
        width: '100%',
        backgroundColor: theme.colors.surfaceBackground,
        flex: 1,
      }}
    >
      <Text style={{ marginBottom: 8 }}>Content Above</Text>
      {children}
      <Text style={{ marginTop: 8 }}>Content Below</Text>
    </View>
  );
};

const DividerMeta: Meta<typeof Divider> = {
  title: 'UI Components/Divider',
  component: Divider,
  args: {
    height: 1,
  },
  decorators: [
    (Story) => (
      <StoryContainer>
        <Story />
      </StoryContainer>
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
