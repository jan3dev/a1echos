import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Session } from '../../../models/Session';
import { useSessionStore } from '../../../stores/sessionStore';
import { useTheme } from '../../../theme/useTheme';
import { Divider } from '../../ui/divider';
import { SessionListItem } from './SessionListItem';

interface SessionListProps {
  selectionMode: boolean;
  selectedSessionIds: Set<string>;
  onSessionLongPress: (session: Session) => void;
  onSessionTap: (sessionId: string) => void;
  onSelectionToggle: (sessionId: string) => void;
}

export const SessionList = ({
  selectionMode,
  selectedSessionIds,
  onSessionLongPress,
  onSessionTap,
  onSelectionToggle,
}: SessionListProps) => {
  const { theme } = useTheme();
  const { sessions } = useSessionStore();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfacePrimary,
          shadowColor: theme.colors.surfaceInverse,
        },
      ]}
    >
      {sessions.map((session, index) => (
        <React.Fragment key={session.id}>
          <SessionListItem
            session={session}
            selectionMode={selectionMode}
            isSelected={selectedSessionIds.has(session.id)}
            onTap={() =>
              selectionMode
                ? onSelectionToggle(session.id)
                : onSessionTap(session.id)
            }
            onLongPress={() => onSessionLongPress(session)}
          />
          {index < sessions.length - 1 && <Divider />}
        </React.Fragment>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 4,
    overflow: 'hidden',
  },
});
