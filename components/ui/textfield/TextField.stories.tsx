import type { Meta, StoryObj } from '@storybook/react';
import { ComponentProps, ReactNode, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon, TextField } from '@/components';
import { AquaTypography, useTheme } from '@/theme';

const StoryContainer = ({ children }: { children: ReactNode }) => {
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
  title: 'UI Components/TextField',
  component: TextField,
  decorators: [
    (Story) => (
      <StoryContainer>
        <Story />
      </StoryContainer>
    ),
  ],
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

const TextFieldWithState = (
  props: Omit<ComponentProps<typeof TextField>, 'onChangeText'>
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

const WithTrailingIconContent = () => {
  const { theme } = useTheme();
  return (
    <TextFieldWithState
      label="Settings"
      trailingIcon={
        <Icon name="settings" size={20} color={theme.colors.textSecondary} />
      }
      onTrailingPress={() => console.log('Settings clicked')}
    />
  );
};

export const WithTrailingIcon: Story = {
  render: () => <WithTrailingIconContent />,
};

const WithBothIconsContent = () => {
  const { theme } = useTheme();
  return (
    <TextFieldWithState
      label="Password"
      value="password123"
      showClearIcon={true}
      trailingIcon={
        <Icon name="settings" size={20} color={theme.colors.textSecondary} />
      }
      secureTextEntry
    />
  );
};

export const WithBothIcons: Story = {
  render: () => <WithBothIconsContent />,
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

const AllVariantsContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.column}>
      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
          Basic
        </Text>
        <TextFieldWithState label="Email" />
      </View>

      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
          With Value
        </Text>
        <TextFieldWithState label="Name" value="John Doe" />
      </View>

      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
          With Assistive Text
        </Text>
        <TextFieldWithState
          label="Password"
          assistiveText="Must be at least 8 characters"
          secureTextEntry
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
          Error State
        </Text>
        <TextFieldWithState
          label="Email"
          value="invalid"
          error={true}
          assistiveText="Please enter a valid email"
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
          With Counter
        </Text>
        <TextFieldWithState label="Bio" maxLength={100} showCounter={true} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
          With Clear Icon
        </Text>
        <TextFieldWithState label="Search" value="Query" showClearIcon={true} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
          With Transparent Border
        </Text>
        <TextFieldWithState label="Description" transparentBorder={true} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
          Multiline
        </Text>
        <TextFieldWithState
          label="Notes"
          multiline={true}
          maxLength={200}
          showCounter={true}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
          Disabled
        </Text>
        <TextFieldWithState
          label="Disabled"
          value="Cannot edit"
          enabled={false}
        />
      </View>
    </View>
  );
};

export const AllVariants: Story = {
  render: () => <AllVariantsContent />,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  column: {
    gap: 24,
  },
  section: {
    gap: 12,
  },
  heading: {
    ...AquaTypography.h5SemiBold,
  },
});
