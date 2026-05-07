import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { EmptyStateView, HomeAppBar, HomeContent } from "@/components";
import { Session } from "@/models";
import { useSessionStore, useSettingsStore } from "@/stores";
import type { GalleryEntry } from "@/app/(design-system)/manifest";

// Mock Data
const dummySessions: Session[] = [
  {
    id: "1",
    name: "Morning Meeting",
    timestamp: new Date(),
    lastModified: new Date(),
    isIncognito: false,
  },
  {
    id: "2",
    name: "Project Discussion",
    timestamp: new Date(Date.now() - 86400000), // Yesterday
    lastModified: new Date(Date.now() - 86000000),
    isIncognito: true,
  },
];

const useSeedStore = () => {
  useEffect(() => {
    useSessionStore.setState({
      sessions: dummySessions,
    });
    useSettingsStore.setState({
      isIncognitoMode: false,
      hasSeenIncognitoExplainer: false,
    });
  }, []);
};

// --- HomeAppBar ---

export const AppBarDefault = () => {
  useSeedStore();
  return (
    <View>
      <View style={{ zIndex: 1 }}>
        <HomeAppBar selectionMode={false} />
      </View>

      <View>
        <HomeContent
          selectionMode={false}
          selectedSessionIds={new Set()}
          onSessionLongPress={(s) => console.log("Long press", s.id)}
          onSessionTap={(id) => console.log("Tap", id)}
          onSelectionToggle={(id) => console.log("Toggle", id)}
        />
      </View>
    </View>
  );
};

export const AppBarSelectionMode = () => {
  useSeedStore();
  return (
    <View>
      <View style={{ zIndex: 1 }}>
        <HomeAppBar
          selectionMode={true}
          onDeleteSelected={() => console.log("Delete selected")}
          onExitSelectionMode={() => console.log("Exit selection mode")}
        />
      </View>

      <View>
        <HomeContent
          selectionMode={true}
          selectedSessionIds={new Set(["1"])}
          onSessionLongPress={(s) => console.log("Long press", s.id)}
          onSessionTap={(id) => console.log("Tap", id)}
          onSelectionToggle={(id) => console.log("Toggle", id)}
        />
      </View>
    </View>
  );
};

// --- EmptyStateView ---

export const EmptyState = () => {
  useSeedStore();
  return (
    <View style={styles.centerContainer}>
      <EmptyStateView
        message="Hit the record button to start transcribing"
        shouldDisappear={false}
      />
    </View>
  );
};

export const EmptyStateDisappearing = () => {
  useSeedStore();
  return (
    <View style={styles.centerContainer}>
      <EmptyStateView
        message="Hit the record button to start transcribing"
        shouldDisappear={true}
        onDisappearComplete={() => console.log("Disappear complete")}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
});

const gallery: GalleryEntry = {
  slug: "home",
  title: "Home",
  group: "Domain",
  demos: [
    { name: "AppBarDefault", render: AppBarDefault },
    { name: "AppBarSelectionMode", render: AppBarSelectionMode },
    { name: "EmptyState", render: EmptyState },
    { name: "EmptyStateDisappearing", render: EmptyStateDisappearing },
  ],
};

export default gallery;
