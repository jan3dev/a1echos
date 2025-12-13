import type { Meta, StoryObj } from '@storybook/react';
import { ReactNode } from 'react';
import { View } from 'react-native';

import { ProgressIndicator } from '@/components';
import { lightColors, useTheme } from '@/theme';

const StoryContainer = ({ children }: { children: ReactNode }) => {
  const { theme } = useTheme();
  return (
    <View
      style={{
        padding: 20,
        alignItems: 'center',
        flex: 1,
        backgroundColor: theme.colors.surfaceBackground,
      }}
    >
      {children}
    </View>
  );
};

const meta = {
  title: 'UI Components/ProgressIndicator',
  component: ProgressIndicator,
  decorators: [
    (Story) => (
      <StoryContainer>
        <Story />
      </StoryContainer>
    ),
  ],
} satisfies Meta<typeof ProgressIndicator>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <DefaultStory />,
};

const DefaultStory = () => {
  const { theme } = useTheme();
  return <ProgressIndicator color={theme.colors.accentBrand} />;
};

export const CustomColor: Story = {
  render: () => <CustomColorStory />,
};

const CustomColorStory = () => {
  const { theme } = useTheme();
  return <ProgressIndicator color={theme.colors.accentDanger} />;
};

export const CustomSize: Story = {
  render: () => <CustomSizeStory />,
};

const CustomSizeStory = () => {
  const { theme } = useTheme();
  return <ProgressIndicator color={theme.colors.accentBrand} size={48} />;
};

export const InverseColor: Story = {
  render: () => <InverseColorStory />,
};

const InverseColorStory = () => {
  const { theme } = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.accentBrand,
        padding: 20,
        borderRadius: 8,
      }}
    >
      <ProgressIndicator color={lightColors.textInverse} />
    </View>
  );
};

export const AllVariants: Story = {
  render: () => <AllVariantsStory />,
};

const AllVariantsStory = () => {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 20 }}>
      <View style={{ alignItems: 'center' }}>
        <ProgressIndicator color={theme.colors.accentBrand} size={24} />
      </View>
      <View style={{ alignItems: 'center' }}>
        <ProgressIndicator color={theme.colors.accentDanger} size={24} />
      </View>
      <View style={{ alignItems: 'center' }}>
        <ProgressIndicator color={theme.colors.accentSuccess} size={24} />
      </View>
      <View style={{ alignItems: 'center' }}>
        <ProgressIndicator color={theme.colors.accentWarning} size={24} />
      </View>
    </View>
  );
};
