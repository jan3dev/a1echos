import { StyleSheet, View } from "react-native";

import { Session } from "@/models";
import { useSessions } from "@/stores";

import { SessionListItem } from "../session-list-item/SessionListItem";

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
  const sessions = useSessions();

  return (
    <View style={styles.list}>
      {sessions.map((session) => (
        <SessionListItem
          key={session.id}
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
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
});
