import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { ProgressIndicator } from './ProgressIndicator';

const meta = {
  title: 'Components/ProgressIndicator',
  component: ProgressIndicator,
  decorators: [
    (Story) => (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <Story />
      </View>
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
      <ProgressIndicator color={theme.colors.textInverse} />
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
