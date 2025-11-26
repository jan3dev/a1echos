import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AquaTypography } from '../../../theme/typography';
import { Radio } from './Radio';

const meta = {
  title: 'UI Components/Radio',
  component: Radio,
  decorators: [
    (Story) => (
      <View style={styles.container}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof Radio>;

export default meta;
type Story = StoryObj<typeof meta>;

const RadioGroup = ({ size = 'large' }: { size?: 'large' | 'small' }) => {
  const [selected, setSelected] = useState('option1');
  return (
    <View style={styles.radioGroup}>
      <View style={styles.radioItem}>
        <Radio
          value="option1"
          groupValue={selected}
          onValueChange={setSelected}
          size={size}
        />
        <Text style={styles.label}>Option 1</Text>
      </View>
      <View style={styles.radioItem}>
        <Radio
          value="option2"
          groupValue={selected}
          onValueChange={setSelected}
          size={size}
        />
        <Text style={styles.label}>Option 2</Text>
      </View>
      <View style={styles.radioItem}>
        <Radio
          value="option3"
          groupValue={selected}
          onValueChange={setSelected}
          size={size}
        />
        <Text style={styles.label}>Option 3</Text>
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

export const Disabled: Story = {
  args: {
    value: 'option1',
    groupValue: 'option1',
    onValueChange: () => {},
    enabled: false,
    size: 'large',
  },
  render: () => (
    <View style={styles.radioGroup}>
      <View style={styles.radioItem}>
        <Radio
          value="option1"
          groupValue="option1"
          enabled={false}
          size="large"
        />
        <Text style={styles.label}>Selected Disabled</Text>
      </View>
      <View style={styles.radioItem}>
        <Radio
          value="option2"
          groupValue="option1"
          enabled={false}
          size="large"
        />
        <Text style={styles.label}>Unselected Disabled</Text>
      </View>
    </View>
  ),
};

export const AllVariants: Story = {
  args: {
    value: 'option1',
    groupValue: 'option1',
    onValueChange: () => {},
    enabled: true,
    size: 'large',
  },
  render: () => (
    <View style={styles.column}>
      <View style={styles.section}>
        <Text style={styles.heading}>Large</Text>
        <RadioGroup size="large" />
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Small</Text>
        <RadioGroup size="small" />
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Disabled</Text>
        <View style={styles.radioGroup}>
          <View style={styles.radioItem}>
            <Radio
              value="option1"
              groupValue="option1"
              enabled={false}
              size="large"
            />
            <Text style={styles.label}>Selected</Text>
          </View>
          <View style={styles.radioItem}>
            <Radio
              value="option2"
              groupValue="option1"
              enabled={false}
              size="large"
            />
            <Text style={styles.label}>Unselected</Text>
          </View>
        </View>
      </View>
    </View>
  ),
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#F4F5F6',
  },
  column: {
    gap: 32,
  },
  section: {
    gap: 16,
  },
  heading: {
    ...AquaTypography.h5SemiBold,
    color: '#090A0B',
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
    color: '#090A0B',
  },
});
