import { useEffect, useState } from "react";
import { View } from "react-native";

import {
  SessionActionsSheet,
  SessionAppBar,
  SessionList,
  SessionListItem,
} from "@/components";
import { Button } from "@/components/ui/button/Button";
import { Session } from "@/models";
import { useSessionStore, useTranscriptionStore } from "@/stores";
import type { GalleryEntry } from "@/app/(design-system)/manifest";

// Mock data
const dummySession: Session = {
  id: "session-1",
  name: "Morning Meeting",
  timestamp: new Date("2023-11-20T09:00:00"),
  lastModified: new Date("2023-11-20T10:00:00"),
  isIncognito: false,
};

const dummySession2: Session = {
  id: "session-2",
  name: "Project Discussion",
  timestamp: new Date("2023-11-21T14:00:00"),
  lastModified: new Date("2023-11-21T15:30:00"),
  isIncognito: false,
};

const dummyTranscriptions = [
  {
    id: "t1",
    sessionId: "session-1",
    text: "Hello world",
    timestamp: new Date(),
    audioPath: "",
  },
  {
    id: "t2",
    sessionId: "session-1",
    text: "Another transcription",
    timestamp: new Date(),
    audioPath: "",
  },
];

const useSeedStore = () => {
  useEffect(() => {
    useSessionStore.setState({
      sessions: [dummySession, dummySession2],
      activeSessionId: dummySession.id,
    });
    useTranscriptionStore.setState({
      transcriptions: dummyTranscriptions,
    });
  }, []);
};

// --- SessionListItem ---

export const ListItem = () => {
  useSeedStore();
  return (
    <SessionListItem
      session={dummySession}
      onTap={() => console.log("Tapped")}
      onLongPress={() => console.log("Long Pressed")}
      onMorePress={(s) => console.log("More", s.name)}
    />
  );
};

export const ListItemSelectionMode = () => {
  useSeedStore();
  return (
    <SessionListItem
      session={dummySession}
      onTap={() => console.log("Tapped")}
      onLongPress={() => console.log("Long Pressed")}
      selectionMode={true}
      isSelected={true}
    />
  );
};

export const ListItemUnselected = () => {
  useSeedStore();
  return (
    <SessionListItem
      session={dummySession2}
      onTap={() => console.log("Tapped")}
      onLongPress={() => console.log("Long Pressed")}
      selectionMode={true}
      isSelected={false}
    />
  );
};

// --- SessionList ---

export const List = () => {
  useSeedStore();
  return (
    <SessionList
      selectionMode={false}
      selectedSessionIds={new Set()}
      onSessionTap={(id) => console.log("Tap", id)}
      onSessionLongPress={(s) => console.log("Long Press", s.name)}
      onSelectionToggle={(id) => console.log("Toggle", id)}
      onSessionMorePress={(s) => console.log("More", s.name)}
    />
  );
};

export const ListSelectionMode = () => {
  useSeedStore();
  return (
    <SessionList
      selectionMode={true}
      selectedSessionIds={new Set(["session-1"])}
      onSessionTap={(id) => console.log("Tap", id)}
      onSessionLongPress={(s) => console.log("Long Press", s.name)}
      onSelectionToggle={(id) => console.log("Toggle", id)}
      onSessionMorePress={(s) => console.log("More", s.name)}
    />
  );
};

// --- SessionAppBar ---

export const AppBarDefault = () => {
  useSeedStore();
  return (
    <View style={{ height: 100 }}>
      <SessionAppBar
        sessionName="Morning Meeting"
        selectionMode={false}
        isIncognitoSession={false}
        onBackPressed={() => console.log("Back")}
        onTitlePressed={() => console.log("Title")}
      />
    </View>
  );
};

export const AppBarIncognito = () => {
  useSeedStore();
  return (
    <View style={{ height: 100 }}>
      <SessionAppBar
        sessionName="Incognito Session"
        selectionMode={false}
        isIncognitoSession={true}
        onBackPressed={() => console.log("Back")}
      />
    </View>
  );
};

export const AppBarSelectionMode = () => {
  useSeedStore();
  return (
    <View style={{ height: 100 }}>
      <SessionAppBar
        sessionName="Morning Meeting"
        selectionMode={true}
        isIncognitoSession={false}
        onBackPressed={() => console.log("Back")}
        onSelectAllPressed={() => console.log("Select All")}
        onDeleteSelectedPressed={() => console.log("Delete Selected")}
      />
    </View>
  );
};

export const AppBarEditMode = () => {
  useSeedStore();
  return (
    <View style={{ height: 100 }}>
      <SessionAppBar
        sessionName="Morning Meeting"
        selectionMode={false}
        editMode={true}
        isIncognitoSession={false}
        onCancelEditPressed={() => console.log("Cancel Edit")}
        onSaveEditPressed={() => console.log("Save Edit")}
      />
    </View>
  );
};

// --- SessionActionsSheet ---

export const ActionsSheetDefault = () => {
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Button.primary
        text="Open actions sheet"
        onPress={() => setVisible(true)}
      />
      <SessionActionsSheet
        visible={visible}
        title="Morning Meeting"
        createdAt={new Date(2024, 3, 18, 10, 0, 0)}
        modifiedAt={new Date(2024, 3, 19, 7, 18, 0)}
        onRename={() => setVisible(false)}
        onDelete={() => setVisible(false)}
        onDismiss={() => setVisible(false)}
      />
    </View>
  );
};

export const ActionsSheetNeverModified = () => {
  const [visible, setVisible] = useState(false);
  const created = new Date(2024, 3, 18, 10, 0, 0);
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Button.primary
        text="Open (created == modified)"
        onPress={() => setVisible(true)}
      />
      <SessionActionsSheet
        visible={visible}
        title="Fresh session"
        createdAt={created}
        modifiedAt={created}
        onRename={() => setVisible(false)}
        onDelete={() => setVisible(false)}
        onDismiss={() => setVisible(false)}
      />
    </View>
  );
};

export const ActionsSheetLongTitle = () => {
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Button.primary
        text="Open with long title"
        onPress={() => setVisible(true)}
      />
      <SessionActionsSheet
        visible={visible}
        title="A particularly long session title that should ellipsize gracefully"
        createdAt={new Date(2024, 3, 18, 10, 0, 0)}
        modifiedAt={new Date(2024, 3, 19, 7, 18, 0)}
        onRename={() => setVisible(false)}
        onDelete={() => setVisible(false)}
        onDismiss={() => setVisible(false)}
      />
    </View>
  );
};

const gallery: GalleryEntry = {
  slug: "session",
  title: "Session",
  group: "Domain",
  demos: [
    { name: "ListItem", render: ListItem },
    { name: "ListItemSelectionMode", render: ListItemSelectionMode },
    { name: "ListItemUnselected", render: ListItemUnselected },
    { name: "List", render: List },
    { name: "ListSelectionMode", render: ListSelectionMode },
    { name: "AppBarDefault", render: AppBarDefault },
    { name: "AppBarIncognito", render: AppBarIncognito },
    { name: "AppBarSelectionMode", render: AppBarSelectionMode },
    { name: "AppBarEditMode", render: AppBarEditMode },
    { name: "ActionsSheetDefault", render: ActionsSheetDefault },
    { name: "ActionsSheetNeverModified", render: ActionsSheetNeverModified },
    { name: "ActionsSheetLongTitle", render: ActionsSheetLongTitle },
  ],
};

export default gallery;
