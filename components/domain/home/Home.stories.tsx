import type { Meta, StoryObj } from '@storybook/react';
import { ComponentType, ReactNode, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyStateView, HomeAppBar, HomeContent } from '@/components';
import { Session } from '@/models';
import { useSessionStore, useSettingsStore } from '@/stores';
import { useTheme } from '@/theme';

// Mock Data
const dummySessions: Session[] = [
  {
    id: '1',
    name: 'Morning Meeting',
    timestamp: new Date(),
    lastModified: new Date(),
    isIncognito: false,
  },
  {
    id: '2',
    name: 'Project Discussion',
    timestamp: new Date(Date.now() - 86400000), // Yesterday
    lastModified: new Date(Date.now() - 86000000),
    isIncognito: true,
  },
];

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

// Decorator
const StoreDecorator = (Story: ComponentType) => {
  useEffect(() => {
    useSessionStore.setState({
      sessions: dummySessions,
    });
    useSettingsStore.setState({
      isIncognitoMode: false,
      hasSeenIncognitoExplainer: false,
    });
  }, []);

  return (
    <StoryContainer>
      <Story />
    </StoryContainer>
  );
};

const meta = {
  title: 'Domain Components/Home',
  decorators: [StoreDecorator],
} satisfies Meta;

export default meta;

type Story = StoryObj;

// --- HomeAppBar ---

export const AppBarDefault: Story = {
  render: () => (
    <View>
      <View style={{ zIndex: 1 }}>
        <HomeAppBar selectionMode={false} />
      </View>

      <View>
        <HomeContent
          selectionMode={false}
          selectedSessionIds={new Set()}
          onSessionLongPress={(s) => console.log('Long press', s.id)}
          onSessionTap={(id) => console.log('Tap', id)}
          onSelectionToggle={(id) => console.log('Toggle', id)}
        />
      </View>
    </View>
  ),
};

export const AppBarSelectionMode: Story = {
  render: () => (
    <View>
      <View style={{ zIndex: 1 }}>
        <HomeAppBar
          selectionMode={true}
          onDeleteSelected={() => console.log('Delete selected')}
          onExitSelectionMode={() => console.log('Exit selection mode')}
        />
      </View>

      <View>
        <HomeContent
          selectionMode={true}
          selectedSessionIds={new Set(['1'])}
          onSessionLongPress={(s) => console.log('Long press', s.id)}
          onSessionTap={(id) => console.log('Tap', id)}
          onSelectionToggle={(id) => console.log('Toggle', id)}
        />
      </View>
    </View>
  ),
};

// --- EmptyStateView ---

export const EmptyState: Story = {
  render: () => (
    <View style={styles.centerContainer}>
      <EmptyStateView
        message="Hit the record button to start transcribing"
        shouldDisappear={false}
      />
    </View>
  ),
};

export const EmptyStateDisappearing: Story = {
  render: () => (
    <View style={styles.centerContainer}>
      <EmptyStateView
        message="Hit the record button to start transcribing"
        shouldDisappear={true}
        onDisappearComplete={() => console.log('Disappear complete')}
      />
    </View>
  ),
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
