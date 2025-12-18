import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { Session } from '@/models';
import { useSessions } from '@/stores';
import { getShadow, useTheme } from '@/theme';

import { Divider } from '../../ui/divider/Divider';

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
  const sessions = useSessions();

  return (
    <View
      style={[
        styles.shadowContainer,
        getShadow('card'),
        { backgroundColor: theme.colors.surfacePrimary },
      ]}
    >
      <View style={styles.clipContainer}>
        {sessions.map((session, index) => (
          <Fragment key={session.id}>
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
          </Fragment>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  shadowContainer: {
    borderRadius: 8,
  },
  clipContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
});
