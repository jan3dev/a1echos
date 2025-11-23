import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AquaTypography } from '../../theme/typography';
import { Toggle } from './Toggle';

const meta = {
  title: 'Components/Toggle',
  component: Toggle,
  decorators: [
    (Story) => (
      <View style={styles.container}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

const ToggleWithState = (props: React.ComponentProps<typeof Toggle>) => {
  const [value, setValue] = useState(props.value || false);
  return <Toggle {...props} value={value} onValueChange={setValue} />;
};

export const Off: Story = {
  args: {
    value: false,
    onValueChange: () => {},
    enabled: true,
  },
  render: () => <ToggleWithState value={false} />,
};

export const On: Story = {
  args: {
    value: true,
    onValueChange: () => {},
    enabled: true,
  },
  render: () => <ToggleWithState value={true} />,
};

export const Disabled: Story = {
  args: {
    value: false,
    onValueChange: () => {},
    enabled: false,
  },
  render: () => (
    <View style={styles.row}>
      <View style={styles.item}>
        <Toggle value={false} enabled={false} />
        <Text style={styles.label}>Off Disabled</Text>
      </View>
      <View style={styles.item}>
        <Toggle value={true} enabled={false} />
        <Text style={styles.label}>On Disabled</Text>
      </View>
    </View>
  ),
};

export const CustomColors: Story = {
  args: {
    value: false,
    onValueChange: () => {},
    enabled: true,
    activeColor: '#18A23B',
    trackColor: '#18A23B',
    thumbColor: '#18A23B',
  },
  render: () => (
    <View style={styles.row}>
      <View style={styles.item}>
        <ToggleWithState value={false} activeColor="#18A23B" />
        <Text style={styles.label}>Custom Green</Text>
      </View>
      <View style={styles.item}>
        <ToggleWithState value={false} activeColor="#FF3B13" />
        <Text style={styles.label}>Custom Red</Text>
      </View>
      <View style={styles.item}>
        <ToggleWithState value={false} activeColor="#FFAB1B" />
        <Text style={styles.label}>Custom Amber</Text>
      </View>
    </View>
  ),
};

export const AllVariants: Story = {
  args: {
    value: false,
    onValueChange: () => {},
    enabled: true,
  },
  render: () => (
    <View style={styles.column}>
      <View style={styles.section}>
        <Text style={styles.heading}>Basic</Text>
        <View style={styles.row}>
          <View style={styles.item}>
            <ToggleWithState value={false} />
            <Text style={styles.label}>Off</Text>
          </View>
          <View style={styles.item}>
            <ToggleWithState value={true} />
            <Text style={styles.label}>On</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Disabled</Text>
        <View style={styles.row}>
          <View style={styles.item}>
            <Toggle value={false} enabled={false} />
            <Text style={styles.label}>Off</Text>
          </View>
          <View style={styles.item}>
            <Toggle value={true} enabled={false} />
            <Text style={styles.label}>On</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Custom Colors</Text>
        <View style={styles.row}>
          <View style={styles.item}>
            <ToggleWithState value={true} activeColor="#18A23B" />
            <Text style={styles.label}>Green</Text>
          </View>
          <View style={styles.item}>
            <ToggleWithState value={true} activeColor="#FF3B13" />
            <Text style={styles.label}>Red</Text>
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
  row: {
    flexDirection: 'row',
    gap: 32,
    alignItems: 'center',
  },
  item: {
    gap: 8,
    alignItems: 'center',
  },
  label: {
    ...AquaTypography.body2,
    color: '#4C5357',
  },
});
