import type { Meta, StoryObj } from '@storybook/react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { InAppBanner, SettingsFooter } from '@/components';
import { useTheme } from '@/theme';

// Decorator to provide theme background
const ThemeDecorator = (Story: React.ComponentType) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceBackground },
      ]}
    >
      <Story />
    </View>
  );
};

const meta = {
  title: 'Domain Components/Settings',
  decorators: [ThemeDecorator],
} satisfies Meta;

export default meta;

type Story = StoryObj;

// --- SettingsFooter ---

export const Footer: Story = {
  render: () => (
    <View style={styles.footerContainer}>
      <SettingsFooter />
    </View>
  ),
};

// --- InAppBanner ---

export const Banner: Story = {
  render: () => (
    <View style={styles.bannerContainer}>
      <InAppBanner />
    </View>
  ),
};

// --- Combined View (as it would appear in Settings Screen) ---

export const SettingsPagePreview: Story = {
  render: () => {
    return (
      <View style={styles.fullContainer}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Settings content would go here */}
          <View style={[styles.placeholder]} />

          {/* Banner */}
          <View style={styles.bannerSection}>
            <InAppBanner />
          </View>
        </ScrollView>

        {/* Footer at bottom */}
        <SettingsFooter />
      </View>
    );
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fullContainer: {
    flex: 1,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bannerContainer: {
    padding: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 64,
  },
  placeholder: {
    height: 200,
    borderRadius: 8,
    marginBottom: 24,
  },
  bannerSection: {
    marginBottom: 24,
  },
});
