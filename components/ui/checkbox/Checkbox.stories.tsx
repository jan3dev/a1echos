import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Checkbox } from '@/components';
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
  title: 'UI Components/Checkbox',
  component: Checkbox,
  decorators: [
    (Story) => (
      <StoryContainer>
        <Story />
      </StoryContainer>
    ),
  ],
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

const CheckboxWithState = (props: React.ComponentProps<typeof Checkbox>) => {
  const [checked, setChecked] = useState(props.value ?? false);
  return <Checkbox {...props} value={checked} onValueChange={setChecked} />;
};

export const LargeChecked: Story = {
  args: {
    value: true,
    size: 'large',
  },
  render: () => <CheckboxWithState value={true} size="large" />,
};

export const LargeUnchecked: Story = {
  args: {
    value: false,
    size: 'large',
  },
  render: () => <CheckboxWithState value={false} size="large" />,
};

export const SmallChecked: Story = {
  args: {
    value: true,
    size: 'small',
  },
  render: () => <CheckboxWithState value={true} size="small" />,
};

export const SmallUnchecked: Story = {
  args: {
    value: false,
    size: 'small',
  },
  render: () => <CheckboxWithState value={false} size="small" />,
};

const DisabledContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.item}>
        <Checkbox value={false} enabled={false} size="large" />
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          Unchecked Disabled
        </Text>
      </View>
      <View style={styles.item}>
        <Checkbox value={true} enabled={false} size="large" />
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          Checked Disabled
        </Text>
      </View>
    </View>
  );
};

export const Disabled: Story = {
  args: {
    value: false,
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
        <View style={styles.row}>
          <View style={styles.item}>
            <Checkbox value={false} size="large" enabled={false} />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Unchecked
            </Text>
          </View>
          <View style={styles.item}>
            <CheckboxWithState value={true} size="large" />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Checked
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
          Small
        </Text>
        <View style={styles.row}>
          <View style={styles.item}>
            <CheckboxWithState value={false} size="small" />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Unchecked
            </Text>
          </View>
          <View style={styles.item}>
            <CheckboxWithState value={true} size="small" />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Checked
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
          Disabled
        </Text>
        <View style={styles.row}>
          <View style={styles.item}>
            <Checkbox value={false} enabled={false} size="large" />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Unchecked
            </Text>
          </View>
          <View style={styles.item}>
            <Checkbox value={true} enabled={false} size="large" />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Checked
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export const AllVariants: Story = {
  args: {
    value: false,
    enabled: false,
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
  },
});
