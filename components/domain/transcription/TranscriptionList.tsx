import React, { useMemo, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { ModelType } from '../../../models/ModelType';
import { Transcription } from '../../../models/Transcription';
import { useSettingsStore } from '../../../stores/settingsStore';
import {
  useSessionTranscriptions,
  useTranscriptionStore,
} from '../../../stores/transcriptionStore';
import { TranscriptionItem } from './TranscriptionItem';

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
  listRef?: React.RefObject<FlatList<Transcription>>;
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

  // Store access
  const transcriptions = useSessionTranscriptions();
  const transcriptionStore = useTranscriptionStore();
  const settingsStore = useSettingsStore();

  const activeSessionId = useRef(
    transcriptions[0]?.sessionId || 'default_session'
  ).current; // Just for fallback

  const livePreview = transcriptionStore.livePreview;
  const loadingPreview = transcriptionStore.loadingPreview;
  const isRecording = transcriptionStore.isRecording();
  const isTranscribing = transcriptionStore.isTranscribing();
  const modelType = settingsStore.selectedModelType;

  // Determine active preview state
  const previewState = useMemo((): ActivePreviewState => {
    const isRealtime = modelType === ModelType.WHISPER_REALTIME;

    // Handle Streaming/Realtime
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

    // Handle File-based Recording (non-realtime)
    if (isRecording && !isRealtime) {
      if (loadingPreview) {
        return {
          item: loadingPreview,
          isStreamingLive: false,
          isLoadingResult: false,
          isRecording: true,
        };
      }

      // Default recording preview if no loading preview yet
      return {
        item: {
          id: 'whisper_recording_preview',
          text: '',
          timestamp: new Date(),
          audioPath: '',
          sessionId: activeSessionId,
        },
        isStreamingLive: false,
        isLoadingResult: false,
        isRecording: true,
      };
    }

    // Handle Loading/Transcribing (both file-based and real-time finalization)
    if (isTranscribing) {
      const previewItem = loadingPreview ||
        livePreview || {
          id: 'transcribing_preview',
          text: '',
          timestamp: new Date(),
          audioPath: '',
          sessionId: activeSessionId,
        };
      return {
        item: previewItem,
        isStreamingLive: false,
        isLoadingResult: true,
        isRecording: false,
      };
    }

    return EmptyPreviewState;
  }, [
    livePreview,
    loadingPreview,
    isRecording,
    isTranscribing,
    modelType,
    activeSessionId,
  ]);

  // Merge items with preview
  const data = useMemo(() => {
    let items = [...transcriptions];
    if (previewState.item) {
      // Remove any existing item with same ID (unlikely but safe)
      items = items.filter((t) => t.id !== previewState.item!.id);
      items.push(previewState.item);
    }
    return items;
  }, [transcriptions, previewState.item]);

  const handleStartEdit = (id: string) => {
    setEditingId(id);
    onEditModeStarted?.();
  };

  const handleEndEdit = () => {
    setEditingId(null);
    onEditModeEnded?.();
  };

  const handleUpdateTranscription = (updated: Transcription) => {
    transcriptionStore.updateTranscription(updated);
  };

  if (data.length === 0) return null;

  return (
    <FlatList
      ref={listRef}
      data={data}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{
        padding: 16,
        paddingTop: topPadding + 16,
        flexGrow: 1,
      }}
      ListFooterComponent={<View style={{ height: bottomPadding }} />}
      renderItem={({ item }) => {
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
      }}
    />
  );
};
