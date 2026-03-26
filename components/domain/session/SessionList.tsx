import { Fragment } from "react";

import { Session } from "@/models";
import { useSessions } from "@/stores";

import { Card } from "../../ui/card/Card";
import { Divider } from "../../ui/divider/Divider";

import { SessionListItem } from "./SessionListItem";

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
    <Card>
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
    </Card>
  );
};
