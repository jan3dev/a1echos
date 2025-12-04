import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Transcription } from '../../../models/Transcription';
import { useTranscriptionStore } from '../../../stores/transcriptionStore';
import { useTheme } from '../../../theme/useTheme';
import { TranscriptionList } from './TranscriptionList';

const RECORDING_CONTROLS_HEIGHT = 96;
const APP_BAR_HEIGHT = 60;

interface TranscriptionContentViewProps {
  listRef?: React.RefObject<FlatList<Transcription>>;
  selectionMode: boolean;
  selectedTranscriptionIds: Set<string>;
  onTranscriptionTap: (id: string) => void;
  onTranscriptionLongPress: (id: string) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  isCancellingEdit?: boolean;
}

export const TranscriptionContentView = ({
  listRef,
  selectionMode,
  selectedTranscriptionIds,
  onTranscriptionTap,
  onTranscriptionLongPress,
  onEditStart,
  onEditEnd,
  isCancellingEdit = false,
}: TranscriptionContentViewProps) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const transcriptionStore = useTranscriptionStore();

  const isLoading = transcriptionStore.isLoading();
  const error = transcriptionStore.getError();

  const topPadding = insets.top + APP_BAR_HEIGHT;
  const bottomPadding = insets.bottom + RECORDING_CONTROLS_HEIGHT + 24;

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

  return (
    <TranscriptionList
      listRef={listRef}
      selectionMode={selectionMode}
      selectedTranscriptionIds={selectedTranscriptionIds}
      onTranscriptionTap={onTranscriptionTap}
      onTranscriptionLongPress={onTranscriptionLongPress}
      onEditModeStarted={onEditStart}
      onEditModeEnded={onEditEnd}
      isCancellingEdit={isCancellingEdit}
      topPadding={topPadding}
      bottomPadding={bottomPadding}
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
