import type { Meta } from '@storybook/react-native';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { FlagIcon, Text } from '@/components';
import { useTheme } from '@/theme';

import { flagIcons } from './flagIcons';

const StoryContainer = ({ children }: { children: ReactNode }) => {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: theme.colors.surfaceBackground,
      }}
    >
      {children}
    </View>
  );
};

const FlagIconMeta: Meta<typeof FlagIcon> = {
  title: 'UI Components/FlagIcon',
  component: FlagIcon,
  args: {
    name: 'united_states',
    size: 32,
  },
  argTypes: {
    name: {
      control: 'select',
      options: Object.keys(flagIcons),
    },
    size: {
      control: { type: 'range', min: 16, max: 128, step: 8 },
    },
  },
  decorators: [
    (Story) => (
      <StoryContainer>
        <Story />
      </StoryContainer>
    ),
  ],
};

export default FlagIconMeta;

export const CommonFlags = () => {
  const common = [
    'united_states',
    'united_kingdom',
    'canada',
    'germany',
    'france',
    'spain',
    'italy',
    'japan',
    'china',
    'india',
    'brazil',
    'australia',
  ];

  return (
    <View style={styles.grid}>
      {common.map((name) => (
        <View key={name} style={styles.item}>
          <FlagIcon name={name} size={32} />
          <Text variant="caption2" align="center" style={styles.label}>
            {name}
          </Text>
        </View>
      ))}
    </View>
  );
};

export const Sizes = () => (
  <View style={styles.row}>
    <View style={styles.item}>
      <FlagIcon name="united_states" size={16} />
      <Text variant="caption2">16px</Text>
    </View>
    <View style={styles.item}>
      <FlagIcon name="united_states" size={24} />
      <Text variant="caption2">24px</Text>
    </View>
    <View style={styles.item}>
      <FlagIcon name="united_states" size={32} />
      <Text variant="caption2">32px</Text>
    </View>
    <View style={styles.item}>
      <FlagIcon name="united_states" size={48} />
      <Text variant="caption2">48px</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'flex-end',
  },
  item: {
    alignItems: 'center',
    gap: 8,
    width: 80,
  },
  label: {
    marginTop: 4,
  },
});
