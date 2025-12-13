import type { Meta, StoryObj } from '@storybook/react';
import { ComponentProps, ReactNode, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Toggle } from '@/components';
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
  title: 'UI Components/Toggle',
  component: Toggle,
  decorators: [
    (Story) => (
      <StoryContainer>
        <Story />
      </StoryContainer>
    ),
  ],
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

const ToggleWithState = (props: ComponentProps<typeof Toggle>) => {
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

const DisabledContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.item}>
        <Toggle value={false} enabled={false} />
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          Off Disabled
        </Text>
      </View>
      <View style={styles.item}>
        <Toggle value={true} enabled={false} />
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          On Disabled
        </Text>
      </View>
    </View>
  );
};

export const Disabled: Story = {
  args: {
    value: false,
    onValueChange: () => {},
    enabled: false,
  },
  render: () => <DisabledContent />,
};

const CustomColorsContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.item}>
        <ToggleWithState value={false} activeColor="#18A23B" />
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          Custom Green
        </Text>
      </View>
      <View style={styles.item}>
        <ToggleWithState value={false} activeColor="#FF3B13" />
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          Custom Red
        </Text>
      </View>
      <View style={styles.item}>
        <ToggleWithState value={false} activeColor="#FFAB1B" />
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          Custom Amber
        </Text>
      </View>
    </View>
  );
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
  render: () => <CustomColorsContent />,
};

const AllVariantsContent = () => {
  const { theme } = useTheme();
  return (
    <View style={styles.column}>
      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
          Basic
        </Text>
        <View style={styles.row}>
          <View style={styles.item}>
            <ToggleWithState value={false} />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Off
            </Text>
          </View>
          <View style={styles.item}>
            <ToggleWithState value={true} />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              On
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
            <Toggle value={false} enabled={false} />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Off
            </Text>
          </View>
          <View style={styles.item}>
            <Toggle value={true} enabled={false} />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              On
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>
          Custom Colors
        </Text>
        <View style={styles.row}>
          <View style={styles.item}>
            <ToggleWithState value={true} activeColor="#18A23B" />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Green
            </Text>
          </View>
          <View style={styles.item}>
            <ToggleWithState value={true} activeColor="#FF3B13" />
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Red
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
    onValueChange: () => {},
    enabled: true,
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
