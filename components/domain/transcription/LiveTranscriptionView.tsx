import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Transcription } from '../../../models/Transcription';
import { TranscriptionList } from './TranscriptionList';

interface LiveTranscriptionViewProps {
  listRef?: React.RefObject<FlatList<Transcription>>;
  bottomPadding?: number;
}

export const LiveTranscriptionView = ({
  listRef,
  bottomPadding = 16.0,
}: LiveTranscriptionViewProps) => {
  return (
    <View style={styles.container}>
      <View style={styles.listContainer}>
        <TranscriptionList
          listRef={listRef}
          selectionMode={false}
          selectedTranscriptionIds={new Set()}
          onTranscriptionTap={() => {}}
          onTranscriptionLongPress={() => {}}
          bottomPadding={bottomPadding}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  listContainer: {
    flex: 1,
  },
});
