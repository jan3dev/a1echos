import { useEffect, useState } from "react";
import { Button as RNButton, StyleSheet, View } from "react-native";

import type { GalleryEntry } from "@/app/(dev)/design-system/manifest";
import {
  EmptyStateView,
  HomeAppBar,
  HomeContent,
  IncognitoEmptyState,
} from "@/components";
import { Session } from "@/models";
import { useSessionStore, useSettingsStore } from "@/stores";

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
    });
  }, []);
};

// --- HomeAppBar ---

export const AppBarDefault = () => {
  useSeedStore();
  return (
    <View style={styles.homeStage}>
      <View style={{ zIndex: 1 }}>
        <HomeAppBar />
      </View>

      <View style={styles.contentFill}>
        <HomeContent
          selectionMode={false}
          selectedSessionIds={new Set()}
          onSessionLongPress={(s) => console.log("Long press", s.id)}
          onSessionTap={(id) => console.log("Tap", id)}
          onSelectionToggle={(id) => console.log("Toggle", id)}
          onSessionMorePress={(s) => console.log("More", s.id)}
        />
      </View>
    </View>
  );
};

export const AppBarSelectionState = () => {
  useSeedStore();
  return (
    <View style={styles.homeStage}>
      <View style={{ zIndex: 1 }}>
        <HomeAppBar />
      </View>

      <View style={styles.contentFill}>
        <HomeContent
          selectionMode={true}
          selectedSessionIds={new Set(["1"])}
          onSessionLongPress={(s) => console.log("Long press", s.id)}
          onSessionTap={(id) => console.log("Tap", id)}
          onSelectionToggle={(id) => console.log("Toggle", id)}
          onSessionMorePress={(s) => console.log("More", s.id)}
        />
      </View>
    </View>
  );
};

// --- EmptyStateView ---

export const EmptyState = () => {
  useSeedStore();
  return (
    <View style={styles.emptyStateStage}>
      <EmptyStateView
        message="Hit the record button to start transcribing"
        shouldDisappear={false}
      />
    </View>
  );
};

export const EmptyStateDisappearing = () => {
  useSeedStore();
  const [shouldDisappear, setShouldDisappear] = useState(false);
  return (
    <View style={styles.emptyStateStage}>
      <View style={styles.triggerButton}>
        <RNButton
          title={shouldDisappear ? "Reset" : "Trigger disappear"}
          onPress={() => setShouldDisappear((v) => !v)}
        />
      </View>
      <EmptyStateView
        message="Hit the record button to start transcribing"
        shouldDisappear={shouldDisappear}
        onDisappearComplete={() => console.log("Disappear complete")}
      />
    </View>
  );
};

// --- IncognitoEmptyState ---

export const IncognitoEmpty = () => {
  useSeedStore();
  return (
    <View style={styles.fillContainer}>
      <IncognitoEmptyState />
    </View>
  );
};

const styles = StyleSheet.create({
  homeStage: {
    width: "100%",
    height: 320,
    overflow: "hidden",
  },
  contentFill: {
    flex: 1,
  },
  emptyStateStage: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 24,
    gap: 16,
  },
  triggerButton: {
    alignSelf: "stretch",
    alignItems: "center",
  },
  fillContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
});

const gallery: GalleryEntry = {
  slug: "home",
  title: "Home",
  group: "Domain",
  demos: [
    { name: "AppBarDefault", render: AppBarDefault },
    { name: "AppBarSelectionState", render: AppBarSelectionState },
    { name: "EmptyState", render: EmptyState },
    { name: "EmptyStateDisappearing", render: EmptyStateDisappearing },
    { name: "IncognitoEmpty", render: IncognitoEmpty },
  ],
};

export default gallery;
