import { Canvas, Path, usePathValue } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

import { TranscriptionState } from '@/models';
import { useTranscriptionStore } from '@/stores';
import { AquaColors, AquaPrimitiveColors } from '@/theme';

interface ThreeWaveLinesProps {
  height?: number;
  colors: AquaColors;
  state?: TranscriptionState;
}

interface WaveProfile {
  basePhaseSpeed: number;
  frequency: number;
  verticalOffset: number;
  amplitudeMultiplier: number;
  strokeWidth: number;
  energyFloor: number;
  audioAmplitudeReactivity: number;
  audioSpeedReactivity: number;
  transcribingAmplitude: number;
  transcribingPhaseOffset: number;
  audioOpacityReactivity: number;
}

const WAVE_PROFILES: WaveProfile[] = [
  {
    basePhaseSpeed: 0.015,
    frequency: 2.2,
    verticalOffset: -3.2,
    amplitudeMultiplier: 0.5,
    strokeWidth: 3.0,
    energyFloor: 0.09,
    audioAmplitudeReactivity: 0.8,
    audioSpeedReactivity: 1.0,
    transcribingAmplitude: 0.6,
    transcribingPhaseOffset: 0.0,
    audioOpacityReactivity: 0.1,
  },
  {
    basePhaseSpeed: 0.04,
    frequency: 3.1,
    verticalOffset: 0.0,
    amplitudeMultiplier: 0.42,
    strokeWidth: 2.8,
    energyFloor: 0.07,
    audioAmplitudeReactivity: 1.0,
    audioSpeedReactivity: 1.2,
    transcribingAmplitude: 0.7,
    transcribingPhaseOffset: Math.PI,
    audioOpacityReactivity: 0.05,
  },
  {
    basePhaseSpeed: 0.06,
    frequency: 2.5,
    verticalOffset: 3.6,
    amplitudeMultiplier: 0.85,
    strokeWidth: 2.5,
    energyFloor: 0.06,
    audioAmplitudeReactivity: 0.5,
    audioSpeedReactivity: 1.5,
    transcribingAmplitude: 0.8,
    transcribingPhaseOffset: (2 * Math.PI) / 3,
    audioOpacityReactivity: 0,
  },
];

const STATE_NUM = {
  LOADING: 0,
  READY: 1,
  RECORDING: 2,
  TRANSCRIBING: 3,
  STREAMING: 4,
  ERROR: 5,
} as const;

const PHASE_OFFSETS = [0.0, Math.PI, Math.PI * 2];
const POINTS = 60;
const MAX_AMPLITUDE = 20.0;
const MIN_AMPLITUDE = 2.0;
const AMPLITUDE_RANGE = MAX_AMPLITUDE - MIN_AMPLITUDE;
const POINTS_MINUS_ONE = POINTS - 1;

const WAVE_COLORS = [
  AquaPrimitiveColors.waveOrange,
  '', // Will use accent color
  AquaPrimitiveColors.waveCyan,
];

const stateToNum = (state: TranscriptionState): number => {
  'worklet';
  switch (state) {
    case TranscriptionState.LOADING:
      return STATE_NUM.LOADING;
    case TranscriptionState.READY:
      return STATE_NUM.READY;
    case TranscriptionState.RECORDING:
      return STATE_NUM.RECORDING;
    case TranscriptionState.TRANSCRIBING:
      return STATE_NUM.TRANSCRIBING;
    case TranscriptionState.STREAMING:
      return STATE_NUM.STREAMING;
    case TranscriptionState.ERROR:
      return STATE_NUM.ERROR;
    default:
      return STATE_NUM.READY;
  }
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return { r, g, b };
};

const useAnimatedWave = (
  waveIndex: number,
  audioLevel: { value: number },
  stateNum: { value: number },
  width: { value: number },
  centerY: number,
  colorRgb: { r: number; g: number; b: number }
) => {
  const profile = WAVE_PROFILES[waveIndex];
  const freqTwoPi = profile.frequency * 2 * Math.PI;

  const phase = useSharedValue(PHASE_OFFSETS[waveIndex]);
  const displayLevel = useSharedValue(0);
  const oscillationStrength = useSharedValue(0);
  const transcribingTime = useSharedValue(0);
  const smoothedBaseEnergy = useSharedValue(0.5);
  const smoothedAmplitudeMultiplier = useSharedValue(
    profile.amplitudeMultiplier * 1.5
  );
  const smoothedOpacity = useSharedValue(0.75);
  const smoothedPositionWeight = useSharedValue(0);

  useFrameCallback((frameInfo) => {
    'worklet';
    const dt = frameInfo.timeSincePreviousFrame ?? 33;
    const dtFactor = dt / 33;

    const currentState = stateNum.value;
    const targetLevel = audioLevel.value;
    const isRecordingOrStreaming =
      currentState === STATE_NUM.RECORDING ||
      currentState === STATE_NUM.STREAMING;
    const isTranscribingOrLoading =
      currentState === STATE_NUM.TRANSCRIBING ||
      currentState === STATE_NUM.LOADING;

    const diff = targetLevel - displayLevel.value;
    displayLevel.value += diff * (diff > 0 ? 0.55 : 0.22) * dtFactor;

    let targetBaseEnergy: number;
    let targetAmplitudeMultiplier: number;
    let targetOpacity: number;
    let targetPositionWeight: number;

    if (currentState === STATE_NUM.READY) {
      targetBaseEnergy = 0.5;
      targetAmplitudeMultiplier = profile.amplitudeMultiplier * 1.5;
      targetOpacity = 0.75;
      targetPositionWeight = 0;
    } else if (isTranscribingOrLoading) {
      targetBaseEnergy = 1.0;
      targetAmplitudeMultiplier = profile.transcribingAmplitude;
      targetOpacity = 0.5;
      targetPositionWeight = 0;
    } else {
      const dl = displayLevel.value;
      const audioReactiveEnergy = dl < 0 ? 0 : dl > 1 ? 1 : dl;
      targetBaseEnergy =
        profile.energyFloor +
        audioReactiveEnergy * profile.audioAmplitudeReactivity;
      if (targetBaseEnergy > 1) targetBaseEnergy = 1;
      targetAmplitudeMultiplier = profile.amplitudeMultiplier;
      targetOpacity = 0.75 + dl * profile.audioOpacityReactivity;
      if (targetOpacity > 1) targetOpacity = 1;
      targetPositionWeight = 1;
    }

    const transitionSpeed = 0.15 * dtFactor;
    smoothedBaseEnergy.value +=
      (targetBaseEnergy - smoothedBaseEnergy.value) * transitionSpeed;
    smoothedAmplitudeMultiplier.value +=
      (targetAmplitudeMultiplier - smoothedAmplitudeMultiplier.value) *
      transitionSpeed;
    smoothedOpacity.value +=
      (targetOpacity - smoothedOpacity.value) * transitionSpeed;
    smoothedPositionWeight.value +=
      (targetPositionWeight - smoothedPositionWeight.value) * transitionSpeed;

    if (isTranscribingOrLoading) {
      transcribingTime.value += dt / 1000;
      if (oscillationStrength.value < 1.0) {
        oscillationStrength.value += 0.1 * dtFactor;
        if (oscillationStrength.value > 1) oscillationStrength.value = 1;
      }
    } else if (oscillationStrength.value > 0.0) {
      oscillationStrength.value -= 0.1 * dtFactor;
      if (oscillationStrength.value < 0) {
        oscillationStrength.value = 0;
        transcribingTime.value = 0;
      }
    }

    let phaseStep: number;
    if (currentState === STATE_NUM.READY) {
      phaseStep = profile.basePhaseSpeed * 0.6 * dtFactor;
    } else if (isRecordingOrStreaming) {
      phaseStep =
        profile.basePhaseSpeed *
        4.8 *
        (1.0 + displayLevel.value * profile.audioSpeedReactivity) *
        dtFactor;
    } else {
      phaseStep = profile.basePhaseSpeed * 0.6 * dtFactor;
    }
    phase.value = (phase.value + phaseStep) % (Math.PI * 2);
  });

  const path = usePathValue((p) => {
    'worklet';
    p.reset();

    const w = width.value;
    if (w <= 0) return;

    const oscillation = Math.sin(
      transcribingTime.value * (Math.PI / 3.0) + profile.transcribingPhaseOffset
    );
    const phaseInversion =
      1.0 + (oscillation - 1.0) * oscillationStrength.value;

    const convergenceFactor = 1.0 - displayLevel.value * 0.7;
    const dynamicVerticalOffset =
      profile.verticalOffset *
      (1.0 - smoothedPositionWeight.value * (1.0 - convergenceFactor));
    const adjustedCenterY = centerY + dynamicVerticalOffset;

    const baseEnergy = smoothedBaseEnergy.value;
    const ampMult = smoothedAmplitudeMultiplier.value;
    const posWeight = smoothedPositionWeight.value;
    const currentPhase = phase.value;

    let prevX = 0;
    let prevY = adjustedCenterY;

    for (let i = 0; i < POINTS; i++) {
      const normalizedX = i / POINTS_MINUS_ONE;
      const x = normalizedX * w;

      const distanceFromCenter = Math.abs(normalizedX - 0.5) * 2.0;
      const centerWeight = 1.0 - distanceFromCenter * distanceFromCenter * 0.5;
      const clampedCenterWeight =
        centerWeight < 0.4 ? 0.4 : centerWeight > 1.0 ? 1.0 : centerWeight;
      const positionWeight = 1.0 - posWeight * (1.0 - clampedCenterWeight);

      const rawAmplitude = baseEnergy * ampMult * positionWeight;
      const normalizedAmplitude =
        rawAmplitude < 0 ? 0 : rawAmplitude > 1 ? 1 : rawAmplitude;
      const amplitude = MIN_AMPLITUDE + normalizedAmplitude * AMPLITUDE_RANGE;
      const sine = Math.sin(freqTwoPi * normalizedX + currentPhase);
      const energyFactor = 0.65 + normalizedAmplitude * 0.35;
      const y =
        adjustedCenterY + amplitude * energyFactor * sine * phaseInversion;

      if (i === 0) {
        p.moveTo(x, y);
      } else {
        const dx = x - prevX;
        const dy = y - prevY;
        p.cubicTo(
          prevX + dx * 0.33,
          prevY + dy * 0.33,
          prevX + dx * 0.66,
          prevY + dy * 0.66,
          x,
          y
        );
      }
      prevX = x;
      prevY = y;
    }
  });

  const color = useDerivedValue(() => {
    const opacity = smoothedOpacity.value;
    return `rgba(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b}, ${opacity})`;
  });

  return { path, color, strokeWidth: profile.strokeWidth };
};

export const ThreeWaveLines = ({
  height = 42.0,
  colors,
  state = TranscriptionState.RECORDING,
}: ThreeWaveLinesProps) => {
  const containerWidth = useSharedValue(400);
  const audioLevel = useSharedValue(0);
  const stateNum = useSharedValue(stateToNum(state));

  useEffect(() => {
    stateNum.value = stateToNum(state);
  }, [state, stateNum]);

  useEffect(() => {
    let prevLevel = useTranscriptionStore.getState().audioLevel;
    const updateAudioLevel = (level: number) => {
      'worklet';
      audioLevel.value = level < 0 ? 0 : level > 1 ? 1 : level;
    };

    const unsubscribe = useTranscriptionStore.subscribe((zustandState) => {
      const level = zustandState.audioLevel;
      if (level !== prevLevel) {
        prevLevel = level;
        scheduleOnUI(updateAudioLevel, level);
      }
    });
    return unsubscribe;
  }, [audioLevel]);

  const centerY = height / 2;

  const color0Rgb = useMemo(() => hexToRgb(WAVE_COLORS[0]), []);
  const color1Rgb = useMemo(
    () => hexToRgb(colors.accentBrand),
    [colors.accentBrand]
  );
  const color2Rgb = useMemo(() => hexToRgb(WAVE_COLORS[2]), []);

  const wave0 = useAnimatedWave(
    0,
    audioLevel,
    stateNum,
    containerWidth,
    centerY,
    color0Rgb
  );
  const wave1 = useAnimatedWave(
    1,
    audioLevel,
    stateNum,
    containerWidth,
    centerY,
    color1Rgb
  );
  const wave2 = useAnimatedWave(
    2,
    audioLevel,
    stateNum,
    containerWidth,
    centerY,
    color2Rgb
  );

  return (
    <View
      style={[styles.container, { height }]}
      onLayout={(event) => {
        const { width } = event.nativeEvent.layout;
        if (width > 0) {
          containerWidth.value = width;
        }
      }}
    >
      <Canvas style={styles.canvas}>
        <Path
          path={wave0.path}
          color={wave0.color}
          style="stroke"
          strokeWidth={wave0.strokeWidth}
          strokeCap="round"
          strokeJoin="round"
        />
        <Path
          path={wave1.path}
          color={wave1.color}
          style="stroke"
          strokeWidth={wave1.strokeWidth}
          strokeCap="round"
          strokeJoin="round"
        />
        <Path
          path={wave2.path}
          color={wave2.color}
          style="stroke"
          strokeWidth={wave2.strokeWidth}
          strokeCap="round"
          strokeJoin="round"
        />
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  canvas: {
    flex: 1,
  },
});
