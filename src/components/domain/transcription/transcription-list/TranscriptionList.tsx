import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Keyboard,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { ScrollToEdgeButton } from "@/components/shared/scroll-to-edge-button";
import { AppConstants } from "@/constants";
import { useLocalization, useProgrammaticScrollGuard } from "@/hooks";
import { Transcription, TranscriptionMode } from "@/models";
import {
  useSessionTranscriptions,
  useSettingsStore,
  useTranscriptionStore,
} from "@/stores";
import { useTheme } from "@/theme";

import { TranscriptionItem } from "../transcription-item/TranscriptionItem";

interface TranscriptionListProps {
  onTranscriptionTap: (id: string) => void;
  onTranscriptionLongPress: (id: string) => void;
  selectionMode?: boolean;
  selectedTranscriptionIds?: Set<string>;
  onEditModeStarted?: () => void;
  onEditModeEnded?: () => void;
  isCancellingEdit?: boolean;
  topPadding?: number;
  bottomPadding?: number;
  listRef?: RefObject<FlatList<Transcription>>;
}

interface ActivePreviewState {
  item: Transcription | null;
  isStreamingLive: boolean;
  isLoadingResult: boolean;
  isRecording: boolean;
}

const EmptyPreviewState: ActivePreviewState = {
  item: null,
  isStreamingLive: false,
  isLoadingResult: false,
  isRecording: false,
};

export const TranscriptionList = ({
  onTranscriptionTap,
  onTranscriptionLongPress,
  selectionMode = false,
  selectedTranscriptionIds = new Set(),
  onEditModeStarted,
  onEditModeEnded,
  isCancellingEdit = false,
  topPadding = 0,
  bottomPadding = 16,
  listRef,
}: TranscriptionListProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const { loc } = useLocalization();
  const { theme } = useTheme();
  const { height: viewportHeight } = useWindowDimensions();

  const transcriptions = useSessionTranscriptions();
  const transcriptionStore = useTranscriptionStore();
  const settingsStore = useSettingsStore();

  const activeSessionId = useRef(
    transcriptions[0]?.sessionId || "default_session",
  ).current;

  const livePreview = transcriptionStore.livePreview;
  const loadingPreview = transcriptionStore.loadingPreview;
  const isRecording = transcriptionStore.isRecording();
  const isTranscribing = transcriptionStore.isTranscribing();
  const transcriptionMode = settingsStore.selectedTranscriptionMode;

  const previewState = useMemo((): ActivePreviewState => {
    const isRealtime = transcriptionMode === TranscriptionMode.REALTIME;

    if (isRecording && isRealtime) {
      if (livePreview) {
        return {
          item: livePreview,
          isStreamingLive: true,
          isLoadingResult: false,
          isRecording: false,
        };
      }
    }

    if (isRecording && !isRealtime) {
      if (loadingPreview) {
        return {
          item: loadingPreview,
          isStreamingLive: false,
          isLoadingResult: false,
          isRecording: true,
        };
      }

      return {
        item: {
          id: "whisper_recording_preview",
          text: "",
          timestamp: new Date(),
          audioPath: "",
          sessionId: activeSessionId,
        },
        isStreamingLive: false,
        isLoadingResult: false,
        isRecording: true,
      };
    }

    if (isTranscribing) {
      const previewItem = loadingPreview || livePreview;
      if (previewItem) {
        return {
          item: previewItem,
          isStreamingLive: false,
          isLoadingResult: true,
          isRecording: false,
        };
      }
    }

    return EmptyPreviewState;
  }, [
    livePreview,
    loadingPreview,
    isRecording,
    isTranscribing,
    transcriptionMode,
    activeSessionId,
  ]);

  // Chronological: oldest first, preview appended at the end (visual bottom).
  const data = useMemo(() => {
    if (previewState.item) {
      const filtered = transcriptions.filter(
        (t) => t.id !== previewState.item!.id,
      );
      return [...filtered, previewState.item];
    }
    return transcriptions;
  }, [transcriptions, previewState.item]);

  const [limit, setLimit] = useState<number>(AppConstants.LIST_PAGE_SIZE);
  const [showJumpButton, setShowJumpButton] = useState(false);
  // Unlocks the next bump only after `limit` advances; otherwise duplicate
  // onStartReached fires at the same window would double-bump.
  const lastBumpedAtLimitRef = useRef<number | null>(null);
  const scrollGuard = useProgrammaticScrollGuard();

  // Show only the latest `limit` items; pagination loads older ones from the front.
  const visibleData = useMemo(() => {
    const start = Math.max(0, data.length - limit);
    return data.slice(start);
  }, [data, limit]);
  const hasMore = data.length > limit;

  const editingIdRef = useRef<string | null>(null);

  const scrollToEditingItem = useCallback(() => {
    const currentEditingId = editingIdRef.current;
    if (!currentEditingId || !listRef?.current) return;

    const index = visibleData.findIndex((item) => item.id === currentEditingId);
    if (index === -1) return;

    listRef.current.scrollToIndex({
      index,
      viewPosition: 0.2,
      animated: true,
    });
  }, [listRef, visibleData]);

  useEffect(() => {
    const keyboardEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const subscription = Keyboard.addListener(keyboardEvent, () => {
      if (editingIdRef.current) {
        setTimeout(scrollToEditingItem, 50);
      }
    });
    return () => subscription.remove();
  }, [scrollToEditingItem]);

  const handleStartEdit = useCallback(
    (id: string) => {
      setEditingId(id);
      editingIdRef.current = id;
      onEditModeStarted?.();
      setTimeout(scrollToEditingItem, 100);
    },
    [onEditModeStarted, scrollToEditingItem],
  );

  const handleEndEdit = useCallback(() => {
    setEditingId(null);
    editingIdRef.current = null;
    onEditModeEnded?.();
  }, [onEditModeEnded]);

  const handleScrollToIndexFailed = useCallback(
    (info: {
      index: number;
      highestMeasuredFrameIndex: number;
      averageItemLength: number;
    }) => {
      listRef?.current?.scrollToOffset({
        offset: info.averageItemLength * info.index,
        animated: true,
      });
    },
    [listRef],
  );

  const handleUpdateTranscription = useCallback(
    (updated: Transcription) => {
      transcriptionStore.updateTranscription(updated);
    },
    [transcriptionStore],
  );

  const handleStartReached = useCallback(() => {
    if (!hasMore) return;
    if (lastBumpedAtLimitRef.current === limit) return;
    lastBumpedAtLimitRef.current = limit;
    setLimit((prev) => prev + AppConstants.LIST_PAGE_SIZE);
  }, [hasMore, limit]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (scrollGuard.isActive()) return;
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;
      setShowJumpButton(
        distanceFromBottom >
          viewportHeight * AppConstants.SCROLL_TO_EDGE_THRESHOLD_RATIO,
      );
    },
    [scrollGuard, viewportHeight],
  );

  const handleScrollToLatest = useCallback(() => {
    scrollGuard.begin();
    setShowJumpButton(false);
    listRef?.current?.scrollToEnd({ animated: true });
  }, [listRef, scrollGuard]);

  // Snap to newest on initial layout bursts, but only when content overflows.
  // maintainVisibleContentPosition mis-anchors on iOS when content fits, so we
  // also gate the mVCP prop on the same overflow signal.
  const userHasDraggedRef = useRef(false);
  const isReadyRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [contentOverflows, setContentOverflows] = useState(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingScrollFrameRef = useRef<number | null>(null);
  const listLayoutHeightRef = useRef(0);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      if (pendingScrollFrameRef.current !== null) {
        cancelAnimationFrame(pendingScrollFrameRef.current);
      }
    };
  }, []);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    listLayoutHeightRef.current = event.nativeEvent.layout.height;
  }, []);

  const handleContentSizeChange = useCallback(
    (_contentWidth: number, contentHeight: number) => {
      if (visibleData.length === 0) return;

      const layoutHeight = listLayoutHeightRef.current;
      const overflows = layoutHeight > 0 && contentHeight > layoutHeight + 1;
      setContentOverflows(overflows);

      if (userHasDraggedRef.current && isReadyRef.current) return;

      if (overflows) {
        if (pendingScrollFrameRef.current !== null) {
          cancelAnimationFrame(pendingScrollFrameRef.current);
        }
        pendingScrollFrameRef.current = requestAnimationFrame(() => {
          pendingScrollFrameRef.current = null;
          listRef?.current?.scrollToEnd({ animated: false });
        });
      }

      if (!isReadyRef.current) {
        if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
        revealTimerRef.current = setTimeout(() => {
          isReadyRef.current = true;
          setIsReady(true);
        }, 60);
      }
    },
    [listRef, visibleData.length],
  );

  const handleScrollBeginDrag = useCallback(() => {
    userHasDraggedRef.current = true;
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Transcription }) => {
      const isPreview = previewState.item?.id === item.id;
      const itemState = isPreview ? previewState : EmptyPreviewState;
      const isEditing = editingId === item.id;
      const isAnyEditing = editingId !== null;

      return (
        <TranscriptionItem
          transcription={item}
          selectionMode={
            itemState.isStreamingLive ||
            itemState.isRecording ||
            itemState.isLoadingResult
              ? false
              : selectionMode
          }
          isSelected={!isPreview && selectedTranscriptionIds.has(item.id)}
          isLivePreviewItem={itemState.isStreamingLive}
          isLoadingWhisperResult={itemState.isLoadingResult}
          isWhisperRecording={itemState.isRecording}
          isEditing={isEditing}
          isAnyEditing={isAnyEditing}
          isCancelling={isCancellingEdit}
          onStartEdit={() => handleStartEdit(item.id)}
          onEndEdit={handleEndEdit}
          onTranscriptionUpdate={handleUpdateTranscription}
          onTap={() => {
            if (!isPreview) {
              onTranscriptionTap(item.id);
            }
          }}
          onLongPress={() => {
            if (!isPreview) {
              onTranscriptionLongPress(item.id);
            }
          }}
        />
      );
    },
    [
      editingId,
      handleEndEdit,
      handleStartEdit,
      handleUpdateTranscription,
      isCancellingEdit,
      onTranscriptionLongPress,
      onTranscriptionTap,
      previewState,
      selectedTranscriptionIds,
      selectionMode,
    ],
  );

  if (data.length === 0) return null;

  return (
    <View style={[styles.flex, { opacity: isReady ? 1 : 0 }]}>
      <FlatList
        ref={listRef}
        data={visibleData}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onScrollToIndexFailed={handleScrollToIndexFailed}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        scrollEventThrottle={16}
        onLayout={handleLayout}
        onStartReached={handleStartReached}
        onStartReachedThreshold={0.4}
        onContentSizeChange={handleContentSizeChange}
        maintainVisibleContentPosition={
          contentOverflows ? { minIndexForVisible: 0 } : undefined
        }
        contentContainerStyle={{
          padding: 16,
          paddingTop: topPadding + 16,
          backgroundColor: theme.colors.surfaceBackground,
        }}
        ListFooterComponent={<View style={{ height: bottomPadding }} />}
        renderItem={renderItem}
      />

      <View
        pointerEvents="box-none"
        style={[styles.jumpButtonOverlay, { bottom: bottomPadding + 16 }]}
      >
        <ScrollToEdgeButton
          visible={showJumpButton && !selectionMode}
          direction="down"
          onPress={handleScrollToLatest}
          accessibilityLabel={loc.scrollToLatest}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  jumpButtonOverlay: {
    position: "absolute",
    right: 16,
    zIndex: 200,
    elevation: 200,
  },
});
