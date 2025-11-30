import { AppTheme } from '@/models/AppTheme';
import { useThemeStore } from '@/theme/useThemeStore';
import { BlurView } from 'expo-blur';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { TranscriptionState } from '../../../models/TranscriptionState';
import { AquaColors } from '../../../theme/themeColors';
import { RecordingButton } from './RecordingButton';
import { ThreeWaveLines } from './ThreeWaveLines';

interface RecordingControlsViewProps {
  state?: TranscriptionState;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  audioLevel?: number;
  enabled?: boolean;
  spacing?: number;
  colors: AquaColors;
}

export const RecordingControlsView = ({
  state = TranscriptionState.READY,
  onRecordingStart,
  onRecordingStop,
  audioLevel = 0.0,
  enabled = true,
  spacing = 16.0,
  colors,
}: RecordingControlsViewProps) => {
  const controlsHeight = 96.0;
  const { currentTheme } = useThemeStore();
  const blurTint = currentTheme === AppTheme.DARK ? 'dark' : 'light';

  return (
    <View style={[styles.container, { height: controlsHeight }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <BlurView
          intensity={20}
          tint={blurTint}
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.glassBackground },
          ]}
        />
      </View>
      <View style={[styles.contentContainer, { paddingVertical: spacing }]}>
        <View style={styles.waveContainer}>
          <ThreeWaveLines
            audioLevel={audioLevel}
            colors={colors}
            state={state}
          />
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
