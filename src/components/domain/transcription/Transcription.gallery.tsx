import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { Toast, ToastVariant, TranscriptionItem } from "@/components";
import { ModelType, Transcription, TranscriptionState } from "@/models";
import {
  useSessionStore,
  useSettingsStore,
  useTranscriptionStore,
  useUIStore,
} from "@/stores";

import type { GalleryEntry } from "@/design-system/manifest";

const dummyTranscriptions: Transcription[] = [
  {
    id: "t1",
    sessionId: "session-1",
    text: "First transcription item.",
    timestamp: new Date("2023-11-20T09:30:00"),
    audioPath: "",
  },
  {
    id: "t2",
    sessionId: "session-1",
    text: "Second transcription item with a bit more text to show variety. It can handle multiple lines of text properly when rendered.",
    timestamp: new Date("2023-11-20T09:30:30"),
    audioPath: "",
  },
  {
    id: "t3",
    sessionId: "session-1",
    text: "Third transcription item.",
    timestamp: new Date("2023-11-20T09:31:00"),
    audioPath: "",
  },
];

const makeLivePreviewTranscription = (): Transcription => ({
  id: "live_preview",
  sessionId: "session-1",
  text: "This is a single live preview item...",
  timestamp: new Date(),
  audioPath: "",
});

const makeSkeletonTranscription = (): Transcription => ({
  id: "loading_preview",
  sessionId: "session-1",
  text: "",
  timestamp: new Date(),
  audioPath: "",
});

const useSeedStore = () => {
  useEffect(() => {
    // Setup initial store state
    useSessionStore.setState({
      activeSessionId: "session-1",
    });

    useTranscriptionStore.setState({
      transcriptions: dummyTranscriptions,
      state: TranscriptionState.READY,
    });

    useSettingsStore.setState({
      selectedModelType: ModelType.WHISPER_REALTIME,
    });
  }, []);
};

const ToastOverlay = () => {
  const toasts = useUIStore((s) => s.toasts);
  const hideToast = useUIStore((s) => s.hideToast);

  return (
    <View
      style={{
        position: "absolute",
        top: 50,
        left: 0,
        right: 0,
        padding: 16,
      }}
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          visible={true}
          title={""}
          message={toast.message}
          variant={toast.variant as ToastVariant}
          onDismiss={() => hideToast(toast.id)}
        />
      ))}
    </View>
  );
};

// The real TranscriptionList wraps a FlatList. Nesting it inside the gallery's
// outer ScrollView triggers the "VirtualizedLists should never be nested" warning,
// so the list demos render TranscriptionItem rows directly in a static View.
const StaticTranscriptionList = ({
  selectionMode,
  selectedTranscriptionIds,
}: {
  selectionMode: boolean;
  selectedTranscriptionIds: Set<string>;
}) => (
  <View style={styles.staticList}>
    {dummyTranscriptions.map((t) => (
      <TranscriptionItem
        key={t.id}
        transcription={t}
        selectionMode={selectionMode}
        isSelected={selectedTranscriptionIds.has(t.id)}
        onTap={() => console.log("Tap", t.id)}
        onLongPress={() => console.log("Long Press", t.id)}
      />
    ))}
  </View>
);

export const Default = () => {
  useSeedStore();
  return (
    <View style={styles.fullWidth}>
      <StaticTranscriptionList
        selectionMode={false}
        selectedTranscriptionIds={new Set()}
      />
      <ToastOverlay />
    </View>
  );
};

export const SelectionMode = () => {
  useSeedStore();
  return (
    <View style={styles.fullWidth}>
      <StaticTranscriptionList
        selectionMode={true}
        selectedTranscriptionIds={new Set(["t1", "t3"])}
      />
      <ToastOverlay />
    </View>
  );
};

const LivePreviewSingleItemContent = () => (
  <View style={[styles.fullWidth, styles.singleItemStage]}>
    <TranscriptionItem
      transcription={makeLivePreviewTranscription()}
      isLivePreviewItem={true}
      onTap={() => console.log("Tap")}
      onLongPress={() => console.log("Long Press")}
    />
  </View>
);

export const LivePreviewSingleItem = () => {
  useSeedStore();
  return <LivePreviewSingleItemContent />;
};

const WithSkeletonLoadingContent = () => (
  <View style={[styles.fullWidth, styles.singleItemStage]}>
    <TranscriptionItem
      transcription={makeSkeletonTranscription()}
      isLoadingWhisperResult={true}
      onTap={() => console.log("Tap")}
      onLongPress={() => console.log("Long Press")}
    />
  </View>
);

export const WithSkeletonLoading = () => {
  useSeedStore();
  return <WithSkeletonLoadingContent />;
};

const styles = StyleSheet.create({
  fullWidth: {
    width: "100%",
  },
  staticList: {
    padding: 16,
    gap: 12,
  },
  singleItemStage: {
    padding: 16,
  },
});

const gallery: GalleryEntry = {
  slug: "transcription",
  title: "Transcription",
  group: "Domain",
  demos: [
    { name: "Default", render: Default },
    { name: "SelectionMode", render: SelectionMode },
    { name: "LivePreviewSingleItem", render: LivePreviewSingleItem },
    { name: "WithSkeletonLoading", render: WithSkeletonLoading },
  ],
};

export default gallery;
