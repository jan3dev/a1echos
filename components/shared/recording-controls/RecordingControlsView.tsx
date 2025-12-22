import { StyleSheet, View } from 'react-native';

import { TranscriptionState } from '@/models';
import { AquaColors } from '@/theme';

import { RecordingButton } from './RecordingButton';
import { ThreeWaveLines } from './ThreeWaveLines';

interface RecordingControlsViewProps {
  state?: TranscriptionState;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  enabled?: boolean;
  spacing?: number;
  colors: AquaColors;
}

export const RecordingControlsView = ({
  state = TranscriptionState.READY,
  onRecordingStart,
  onRecordingStop,
  enabled = true,
  spacing = 16.0,
  colors,
}: RecordingControlsViewProps) => {
  const controlsHeight = 96.0;

  return (
    <View style={[styles.container, { height: controlsHeight }]}>
      <View style={[styles.contentContainer, { paddingVertical: spacing }]}>
        <View style={styles.waveContainer} pointerEvents="none">
          <ThreeWaveLines colors={colors} state={state} />
        </View>
        <View style={styles.buttonContainer}>
          <RecordingButton
            state={state}
            onRecordingStart={onRecordingStart}
            onRecordingStop={onRecordingStop}
            enabled={enabled}
            colors={colors}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
  },
  contentContainer: {
    height: 64,
    position: 'relative',
    alignItems: 'center',
  },
  waveContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 11,
    height: 42,
  },
  buttonContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
