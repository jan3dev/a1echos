import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AquaTypography } from '../../../theme/typography';
import { Icon } from '../icon';
import { TextField } from './TextField';

const meta = {
  title: 'UI Components/TextField',
  component: TextField,
  decorators: [
    (Story) => (
      <View style={styles.container}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

const TextFieldWithState = (
  props: Omit<React.ComponentProps<typeof TextField>, 'onChangeText'>
) => {
  const [value, setValue] = useState(props.value || '');
  return <TextField {...props} value={value} onChangeText={setValue} />;
};

export const Basic: Story = {
  render: () => <TextFieldWithState label="Email" />,
};

export const WithValue: Story = {
  render: () => <TextFieldWithState label="Email" value="user@example.com" />,
};

export const WithAssistiveText: Story = {
  render: () => (
    <TextFieldWithState
      label="Password"
      assistiveText="Must be at least 8 characters"
      secureTextEntry
    />
  ),
};

export const WithError: Story = {
  render: () => (
    <TextFieldWithState
      label="Email"
      value="invalid-email"
      error={true}
      assistiveText="Please enter a valid email address"
    />
  ),
};

export const WithCounter: Story = {
  render: () => (
    <TextFieldWithState
      label="Bio"
      maxLength={100}
      showCounter={true}
      assistiveText="Tell us about yourself"
    />
  ),
};

export const WithClearIcon: Story = {
  render: () => (
    <TextFieldWithState
      label="Search"
      value="Search query"
      showClearIcon={true}
    />
  ),
};

export const WithTrailingIcon: Story = {
  render: () => (
    <TextFieldWithState
      label="Settings"
      trailingIcon={<Icon name="settings" size={20} color="#929BA0" />}
      onTrailingPress={() => console.log('Settings clicked')}
    />
  ),
};

export const WithBothIcons: Story = {
  render: () => (
    <TextFieldWithState
      label="Password"
      value="password123"
      showClearIcon={true}
      trailingIcon={<Icon name="settings" size={20} color="#929BA0" />}
      secureTextEntry
    />
  ),
};

export const Multiline: Story = {
  render: () => (
    <TextFieldWithState
      label="Description"
      multiline={true}
      maxLength={200}
      showCounter={true}
    />
  ),
};

export const WithTransparentBorder: Story = {
  render: () => (
    <TextFieldWithState label="Description" transparentBorder={true} />
  ),
};

export const Disabled: Story = {
  render: () => (
    <TextFieldWithState
      label="Disabled Field"
      value="Cannot edit this"
      enabled={false}
    />
  ),
};

export const AllVariants: Story = {
  render: () => (
    <View style={styles.column}>
      <View style={styles.section}>
        <Text style={styles.heading}>Basic</Text>
        <TextFieldWithState label="Email" />
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>With Value</Text>
        <TextFieldWithState label="Name" value="John Doe" />
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>With Assistive Text</Text>
        <TextFieldWithState
          label="Password"
          assistiveText="Must be at least 8 characters"
          secureTextEntry
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Error State</Text>
        <TextFieldWithState
          label="Email"
          value="invalid"
          error={true}
          assistiveText="Please enter a valid email"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>With Counter</Text>
        <TextFieldWithState label="Bio" maxLength={100} showCounter={true} />
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>With Clear Icon</Text>
        <TextFieldWithState label="Search" value="Query" showClearIcon={true} />
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>With Transparent Border</Text>
        <TextFieldWithState label="Description" transparentBorder={true} />
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Multiline</Text>
        <TextFieldWithState
          label="Notes"
          multiline={true}
          maxLength={200}
          showCounter={true}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Disabled</Text>
        <TextFieldWithState
          label="Disabled"
          value="Cannot edit"
          enabled={false}
        />
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
    gap: 24,
  },
  section: {
    gap: 12,
  },
  heading: {
    ...AquaTypography.h5SemiBold,
    color: '#090A0B',
  },
});
