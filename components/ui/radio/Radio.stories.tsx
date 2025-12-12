import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radio } from '@/components';
import { AquaTypography, useTheme } from '@/theme';

const StoryContainer = ({ children }: { children: React.ReactNode }) => {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceBackground },
      ]}
    >
      {children}
    </View>
  );
};

const meta = {
  title: 'UI Components/Radio',
  component: Radio,
  decorators: [
    (Story) => (
      <StoryContainer>
        <Story />
      </StoryContainer>
    ),
  ],
} satisfies Meta<typeof Radio>;

export default meta;
type Story = StoryObj<typeof meta>;

const RadioGroup = ({ size = 'large' }: { size?: 'large' | 'small' }) => {
  const [selected, setSelected] = useState('option1');
  const { theme } = useTheme();

  return (
    <View style={styles.radioGroup}>
      <View style={styles.radioItem}>
        <Radio
          value="option1"
          groupValue={selected}
          onValueChange={setSelected}
          size={size}
        />
        <Text style={[styles.label, { color: theme.colors.textPrimary }]}>
          Option 1
        </Text>
      </View>
      <View style={styles.radioItem}>
        <Radio
          value="option2"
          groupValue={selected}
          onValueChange={setSelected}
          size={size}
        />
        <Text style={[styles.label, { color: theme.colors.textPrimary }]}>
          Option 2
        </Text>
      </View>
      <View style={styles.radioItem}>
        <Radio
          value="option3"
          groupValue={selected}
          onValueChange={setSelected}
          size={size}
        />
        <Text style={[styles.label, { color: theme.colors.textPrimary }]}>
          Option 3
        </Text>
      </View>
    </View>
  );
};

export const Large: Story = {
  args: {
    value: 'option1',
    groupValue: 'option1',
    onValueChange: () => {},
    enabled: true,
    size: 'large',
  },
  render: () => <RadioGroup size="large" />,
};

export const Small: Story = {
  args: {
    value: 'option1',
    groupValue: 'option1',
    onValueChange: () => {},
    enabled: true,
    size: 'small',
  },
  render: () => <RadioGroup size="small" />,
};

const DisabledContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.radioGroup}>
      <View style={styles.radioItem}>
        <Radio
          value="option1"
          groupValue="option1"
          enabled={false}
          size="large"
        />
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          Selected Disabled
        </Text>
      </View>
      <View style={styles.radioItem}>
        <Radio
          value="option2"
          groupValue="option1"
          enabled={false}
          size="large"
        />
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          Unselected Disabled
        </Text>
      </View>
    </View>
  );
};

export const Disabled: Story = {
  args: {
    value: 'option1',
    groupValue: 'option1',
    onValueChange: () => {},
    enabled: false,
    size: 'large',
  },
  render: () => <DisabledContent />,
};

const AllVariantsContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.column}>
      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
          Large
        </Text>
        <RadioGroup size="large" />
      </View>

      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
          Small
        </Text>
        <RadioGroup size="small" />
      </View>

      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
          Disabled
        </Text>
        <View style={styles.radioGroup}>
          <View style={styles.radioItem}>
            <Radio
              value="option1"
              groupValue="option1"
              enabled={false}
              size="large"
            />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Selected
            </Text>
          </View>
          <View style={styles.radioItem}>
            <Radio
              value="option2"
              groupValue="option1"
              enabled={false}
              size="large"
            />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Unselected
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export const AllVariants: Story = {
  args: {
    value: 'option1',
    groupValue: 'option1',
    onValueChange: () => {},
    enabled: true,
    size: 'large',
  },
  render: () => <AllVariantsContent />,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  column: {
    gap: 32,
  },
  section: {
    gap: 16,
  },
  heading: {
    ...AquaTypography.h5SemiBold,
  },
  radioGroup: {
    gap: 16,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    ...AquaTypography.body1,
  },
});
