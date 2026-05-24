import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  SessionActionsSheet,
  SessionAppBar,
  SessionListItem,
} from "@/components";
import { Button } from "@/components/ui/button/Button";
import type { GalleryEntry } from "@/design-system/manifest";
import { Session } from "@/models";
import { useSessionStore, useTranscriptionStore } from "@/stores";

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
    <View style={styles.fullWidth}>
      <SessionListItem
        session={dummySession}
        onTap={() => console.log("Tapped")}
        onLongPress={() => console.log("Long Pressed")}
        onMorePress={(s) => console.log("More", s.name)}
      />
    </View>
  );
};

export const ListItemSelectionMode = () => {
  useSeedStore();
  return (
    <View style={styles.fullWidth}>
      <SessionListItem
        session={dummySession}
        onTap={() => console.log("Tapped")}
        onLongPress={() => console.log("Long Pressed")}
        selectionMode={true}
        isSelected={true}
      />
    </View>
  );
};

export const ListItemUnselected = () => {
  useSeedStore();
  return (
    <View style={styles.fullWidth}>
      <SessionListItem
        session={dummySession2}
        onTap={() => console.log("Tapped")}
        onLongPress={() => console.log("Long Pressed")}
        selectionMode={true}
        isSelected={false}
      />
    </View>
  );
};

// --- SessionAppBar ---

export const AppBarDefault = () => {
  useSeedStore();
  return (
    <View style={{ width: "100%", height: 100 }}>
      <SessionAppBar
        sessionName="Morning Meeting"
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
    <View style={{ width: "100%", height: 100 }}>
      <SessionAppBar
        sessionName="Incognito Session"
        isIncognitoSession={true}
        onBackPressed={() => console.log("Back")}
      />
    </View>
  );
};

export const AppBarEditMode = () => {
  useSeedStore();
  return (
    <View style={{ width: "100%", height: 100 }}>
      <SessionAppBar
        sessionName="Morning Meeting"
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

const styles = StyleSheet.create({
  fullWidth: {
    width: "100%",
  },
});

const gallery: GalleryEntry = {
  slug: "session",
  title: "Session",
  group: "Domain",
  demos: [
    { name: "ListItem", render: ListItem },
    { name: "ListItemSelectionMode", render: ListItemSelectionMode },
    { name: "ListItemUnselected", render: ListItemUnselected },
    { name: "AppBarDefault", render: AppBarDefault },
    { name: "AppBarIncognito", render: AppBarIncognito },
    { name: "AppBarEditMode", render: AppBarEditMode },
    { name: "ActionsSheetDefault", render: ActionsSheetDefault },
    { name: "ActionsSheetNeverModified", render: ActionsSheetNeverModified },
    { name: "ActionsSheetLongTitle", render: ActionsSheetLongTitle },
  ],
};

export default gallery;
