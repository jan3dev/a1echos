import type { Meta, StoryObj } from '@storybook/react';
import { ComponentType, ReactNode, useEffect } from 'react';
import { View } from 'react-native';

import { SessionAppBar, SessionList, SessionListItem } from '@/components';
import { Session } from '@/models';
import { useSessionStore, useTranscriptionStore } from '@/stores';
import { useTheme } from '@/theme';

// Mock data
const dummySession: Session = {
  id: 'session-1',
  name: 'Morning Meeting',
  timestamp: new Date('2023-11-20T09:00:00'),
  lastModified: new Date('2023-11-20T10:00:00'),
  isIncognito: false,
};

const dummySession2: Session = {
  id: 'session-2',
  name: 'Project Discussion',
  timestamp: new Date('2023-11-21T14:00:00'),
  lastModified: new Date('2023-11-21T15:30:00'),
  isIncognito: false,
};

const dummyTranscriptions = [
  {
    id: 't1',
    sessionId: 'session-1',
    text: 'Hello world',
    timestamp: new Date(),
    audioPath: '',
  },
  {
    id: 't2',
    sessionId: 'session-1',
    text: 'Another transcription',
    timestamp: new Date(),
    audioPath: '',
  },
];

const StoryContainer = ({ children }: { children: ReactNode }) => {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        padding: 16,
        backgroundColor: theme.colors.surfaceBackground,
      }}
    >
      {children}
    </View>
  );
};

// Decorator to seed store
const StoreDecorator = (Story: ComponentType) => {
  useEffect(() => {
    useSessionStore.setState({
      sessions: [dummySession, dummySession2],
      activeSessionId: dummySession.id,
    });
    useTranscriptionStore.setState({
      transcriptions: dummyTranscriptions,
    });
  }, []);

  return (
    <StoryContainer>
      <Story />
    </StoryContainer>
  );
};

const meta = {
  title: 'Domain Components/Session',
  decorators: [StoreDecorator],
} satisfies Meta;

export default meta;

type Story = StoryObj;

// --- SessionListItem ---

export const ListItem: Story = {
  render: () => (
    <SessionListItem
      session={dummySession}
      onTap={() => console.log('Tapped')}
      onLongPress={() => console.log('Long Pressed')}
    />
  ),
};

export const ListItemSelectionMode: Story = {
  render: () => (
    <SessionListItem
      session={dummySession}
      onTap={() => console.log('Tapped')}
      onLongPress={() => console.log('Long Pressed')}
      selectionMode={true}
      isSelected={true}
    />
  ),
};

export const ListItemUnselected: Story = {
  render: () => (
    <SessionListItem
      session={dummySession2}
      onTap={() => console.log('Tapped')}
      onLongPress={() => console.log('Long Pressed')}
      selectionMode={true}
      isSelected={false}
    />
  ),
};

// --- SessionList ---

export const List: Story = {
  render: () => (
    <SessionList
      selectionMode={false}
      selectedSessionIds={new Set()}
      onSessionTap={(id) => console.log('Tap', id)}
      onSessionLongPress={(s) => console.log('Long Press', s.name)}
      onSelectionToggle={(id) => console.log('Toggle', id)}
    />
  ),
};

export const ListSelectionMode: Story = {
  render: () => (
    <SessionList
      selectionMode={true}
      selectedSessionIds={new Set(['session-1'])}
      onSessionTap={(id) => console.log('Tap', id)}
      onSessionLongPress={(s) => console.log('Long Press', s.name)}
      onSelectionToggle={(id) => console.log('Toggle', id)}
    />
  ),
};

// --- SessionAppBar ---

export const AppBarDefault: Story = {
  render: () => (
    <View style={{ height: 100 }}>
      <SessionAppBar
        sessionName="Morning Meeting"
        selectionMode={false}
        isIncognitoSession={false}
        onBackPressed={() => console.log('Back')}
        onTitlePressed={() => console.log('Title')}
      />
    </View>
  ),
};

export const AppBarIncognito: Story = {
  render: () => (
    <View style={{ height: 100 }}>
      <SessionAppBar
        sessionName="Incognito Session"
        selectionMode={false}
        isIncognitoSession={true}
        onBackPressed={() => console.log('Back')}
      />
    </View>
  ),
};

export const AppBarSelectionMode: Story = {
  render: () => (
    <View style={{ height: 100 }}>
      <SessionAppBar
        sessionName="Morning Meeting"
        selectionMode={true}
        isIncognitoSession={false}
        onBackPressed={() => console.log('Back')}
        onSelectAllPressed={() => console.log('Select All')}
        onDeleteSelectedPressed={() => console.log('Delete Selected')}
      />
    </View>
  ),
};

export const AppBarEditMode: Story = {
  render: () => (
    <View style={{ height: 100 }}>
      <SessionAppBar
        sessionName="Morning Meeting"
        selectionMode={false}
        editMode={true}
        isIncognitoSession={false}
        onCancelEditPressed={() => console.log('Cancel Edit')}
        onSaveEditPressed={() => console.log('Save Edit')}
      />
    </View>
  ),
};
