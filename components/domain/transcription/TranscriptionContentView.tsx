import React from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { ModelType } from '../../../models/ModelType';
import { Transcription } from '../../../models/Transcription';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useTranscriptionStore } from '../../../stores/transcriptionStore';
import { useTheme } from '../../../theme/useTheme';
import { LiveTranscriptionView } from './LiveTranscriptionView';
import { TranscriptionList } from './TranscriptionList';

const RECORDING_CONTROLS_HEIGHT = 96;

interface TranscriptionContentViewProps {
  listRef?: React.RefObject<FlatList<Transcription>>;
  selectionMode: boolean;
  selectedTranscriptionIds: Set<string>;
  onTranscriptionTap: (id: string) => void;
  onTranscriptionLongPress: (id: string) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
}

export const TranscriptionContentView = ({
  listRef,
  selectionMode,
  selectedTranscriptionIds,
  onTranscriptionTap,
  onTranscriptionLongPress,
  onEditStart,
  onEditEnd,
}: TranscriptionContentViewProps) => {
  const { theme } = useTheme();
  const transcriptionStore = useTranscriptionStore();
  const settingsStore = useSettingsStore();

  const isLoading = transcriptionStore.isLoading();
  const error = transcriptionStore.getError();
  const isRecording = transcriptionStore.isRecording();
  const isRealtime =
    settingsStore.selectedModelType === ModelType.WHISPER_REALTIME;
  const hasLivePreview = !!transcriptionStore.livePreview;

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.accentBrand} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={{ color: theme.colors.accentDanger }}>{error}</Text>
      </View>
    );
  }

  const shouldShowLiveTranscription =
    isRecording || (isRealtime && hasLivePreview);

  if (shouldShowLiveTranscription) {
    return (
      <LiveTranscriptionView
        listRef={listRef}
        bottomPadding={RECORDING_CONTROLS_HEIGHT}
      />
    );
  }

  return (
    <TranscriptionList
      listRef={listRef}
      selectionMode={selectionMode}
      selectedTranscriptionIds={selectedTranscriptionIds}
      onTranscriptionTap={onTranscriptionTap}
      onTranscriptionLongPress={onTranscriptionLongPress}
      onEditModeStarted={onEditStart}
      onEditModeEnded={onEditEnd}
      bottomPadding={RECORDING_CONTROLS_HEIGHT}
    />
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
