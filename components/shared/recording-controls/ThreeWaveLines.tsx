import { Canvas, Path, usePathValue } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef } from 'react';
import { AppState, AppStateStatus, StyleSheet, View } from 'react-native';
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
  transcribingAmplitude: number;
  transcribingPhaseOffset: number;
  audioOpacityReactivity: number;
}

const WAVE_PROFILES: WaveProfile[] = [
  {
    basePhaseSpeed: 0.04,
    frequency: 2.2,
    verticalOffset: -3.2,
    amplitudeMultiplier: 0.35,
    strokeWidth: 3.0,
    energyFloor: 0.06,
    audioAmplitudeReactivity: 0.7,
    transcribingAmplitude: 0.6,
    transcribingPhaseOffset: 0.0,
    audioOpacityReactivity: 0.1,
  },
  {
    basePhaseSpeed: 0.07,
    frequency: 3.1,
    verticalOffset: 0.0,
    amplitudeMultiplier: 0.55,
    strokeWidth: 2.8,
    energyFloor: 0.05,
    audioAmplitudeReactivity: 1.0,
    transcribingAmplitude: 0.7,
    transcribingPhaseOffset: Math.PI,
    audioOpacityReactivity: 0.05,
  },
  {
    basePhaseSpeed: 0.09,
    frequency: 2.5,
    verticalOffset: 3.6,
    amplitudeMultiplier: 0.75,
    strokeWidth: 2.5,
    energyFloor: 0.04,
    audioAmplitudeReactivity: 0.55,
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
const BASE_MAX_AMPLITUDE = 20.0;
const RECORDING_MAX_AMPLITUDE = 32.0;
const MIN_AMPLITUDE = 2.0;
const BASE_AMPLITUDE_RANGE = BASE_MAX_AMPLITUDE - MIN_AMPLITUDE;
const RECORDING_AMPLITUDE_RANGE = RECORDING_MAX_AMPLITUDE - MIN_AMPLITUDE;
const POINTS_MINUS_ONE = POINTS - 1;
const VOICE_THRESHOLD = 0.38;

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
  height: number,
  centerY: number,
  colorRgb: { r: number; g: number; b: number },
  isActive: { value: boolean },
  initialBlipTarget: { value: number },
  hasTriggeredInitialBlip: { value: boolean },
) => {
  const profile = WAVE_PROFILES[waveIndex];
  const freqTwoPi = profile.frequency * 2 * Math.PI;

  const phase = useSharedValue(PHASE_OFFSETS[waveIndex]);
  const displayLevel = useSharedValue(0);
  const prevAudioLevel = useSharedValue(0);
  const initialBlipAmount = useSharedValue(0);
  const isRecording = useSharedValue(0);
  const smoothedFreqLevel = useSharedValue(0);
  const distortionCenter = useSharedValue(0.5);
  const oscillationStrength = useSharedValue(0);
  const transcribingTime = useSharedValue(0);
  const smoothedBaseEnergy = useSharedValue(0.5);
  const smoothedAmplitudeMultiplier = useSharedValue(
    profile.amplitudeMultiplier * 1.5,
  );
  const smoothedOpacity = useSharedValue(0.75);
  const smoothedPositionWeight = useSharedValue(0);
  const phaseSpeedMultiplier = useSharedValue(0.6);
  const speechWobble = useSharedValue(0);
  const levelVelocity = useSharedValue(0);

  useFrameCallback((frameInfo) => {
    'worklet';
    if (!isActive.value) return;

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

    if (isRecordingOrStreaming) {
      isRecording.value = 1;

      // Initial blip: trigger once when first detecting voice
      if (
        !hasTriggeredInitialBlip.value &&
        targetLevel > VOICE_THRESHOLD &&
        initialBlipTarget.value === waveIndex
      ) {
        initialBlipAmount.value = 1.8;
        hasTriggeredInitialBlip.value = true;
      }

      // Decay the initial blip smoothly
      if (initialBlipAmount.value > 0) {
        initialBlipAmount.value *= 0.9;
        if (initialBlipAmount.value < 0.01) {
          initialBlipAmount.value = 0;
        }
      }

      // Track rate of change (velocity) for detecting syllables/words
      const rawVelocity = targetLevel - prevAudioLevel.value;
      levelVelocity.value += (rawVelocity - levelVelocity.value) * 0.3;

      // Sharp attack and release for immediate feedback
      const diff = targetLevel - displayLevel.value;
      const lerpSpeed = diff > 0 ? 0.5 : 0.42;
      displayLevel.value += diff * lerpSpeed * dtFactor;

      // Add speech wobble when voice is active - natural micro-variations
      if (targetLevel > 0.15) {
        const wobbleIntensity = targetLevel * 0.12 * (1 + waveIndex * 0.15);
        const velocityBoost = Math.abs(levelVelocity.value) * 2.0;
        speechWobble.value =
          (Math.random() - 0.5) * wobbleIntensity * (1 + velocityBoost);
      } else {
        speechWobble.value *= 0.85;
      }

      // Apply initial blip boost and speech wobble
      const blipBoost = 1.0 + initialBlipAmount.value;
      let boostedLevel = displayLevel.value * blipBoost + speechWobble.value;
      boostedLevel = boostedLevel > 1.6 ? 1.6 : boostedLevel < 0 ? 0 : boostedLevel;
      displayLevel.value = boostedLevel;

      // Accelerate phase speed based on audio level + velocity
      const velocitySpeedBoost = Math.abs(levelVelocity.value) * 0.8;
      const targetSpeedMult = 1.0 + displayLevel.value * 1.8 + velocitySpeedBoost;
      phaseSpeedMultiplier.value +=
        (targetSpeedMult - phaseSpeedMultiplier.value) * 0.25 * dtFactor;
    } else {
      isRecording.value = 0;
      const diff = targetLevel - displayLevel.value;
      displayLevel.value += diff * (diff > 0 ? 0.15 : 0.1) * dtFactor;
      initialBlipAmount.value = 0;
      speechWobble.value *= 0.9;
      levelVelocity.value *= 0.9;

      // Gradually slow down phase speed when not recording
      phaseSpeedMultiplier.value +=
        (0.6 - phaseSpeedMultiplier.value) * 0.04 * dtFactor;
    }

    prevAudioLevel.value = targetLevel;

    const freqTarget = isRecordingOrStreaming ? displayLevel.value : 0;
    smoothedFreqLevel.value +=
      (freqTarget - smoothedFreqLevel.value) * 0.2 * dtFactor;

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
      const voiceBoost =
        dl > VOICE_THRESHOLD
          ? (dl - VOICE_THRESHOLD) * 0.5 * profile.audioAmplitudeReactivity
          : 0;
      const audioReactiveEnergy = dl < 0 ? 0 : dl > 1 ? 1 : dl;
      targetBaseEnergy =
        profile.energyFloor +
        audioReactiveEnergy * profile.audioAmplitudeReactivity +
        voiceBoost;
      if (targetBaseEnergy > 1.2) targetBaseEnergy = 1.2;
      targetAmplitudeMultiplier = profile.amplitudeMultiplier;
      targetOpacity = 0.75 + dl * profile.audioOpacityReactivity;
      if (targetOpacity > 1) targetOpacity = 1;
      targetPositionWeight = 1;
    }

    // Fast transitions during recording for immediate feedback
    const transitionSpeed = isRecordingOrStreaming ? 0.4 : 0.15;
    const adjustedSpeed = transitionSpeed * dtFactor;
    smoothedBaseEnergy.value +=
      (targetBaseEnergy - smoothedBaseEnergy.value) * adjustedSpeed;
    smoothedAmplitudeMultiplier.value +=
      (targetAmplitudeMultiplier - smoothedAmplitudeMultiplier.value) *
      adjustedSpeed;
    smoothedOpacity.value +=
      (targetOpacity - smoothedOpacity.value) * adjustedSpeed;
    smoothedPositionWeight.value +=
      (targetPositionWeight - smoothedPositionWeight.value) * adjustedSpeed;

    // Move distortion center dynamically during speech
    if (isRecordingOrStreaming && displayLevel.value > 0.2) {
      const velocityShift = levelVelocity.value * 1.5;
      const targetCenter = 0.5 + velocityShift + (Math.random() - 0.5) * 0.08;
      const clampedTarget =
        targetCenter < 0.25 ? 0.25 : targetCenter > 0.75 ? 0.75 : targetCenter;
      distortionCenter.value +=
        (clampedTarget - distortionCenter.value) * 0.15 * dtFactor;
    } else {
      distortionCenter.value +=
        (0.5 - distortionCenter.value) * 0.05 * dtFactor;
    }

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

    const phaseStep =
      profile.basePhaseSpeed * phaseSpeedMultiplier.value * dtFactor;
    phase.value = (phase.value + phaseStep) % (Math.PI * 2);
  });

  const path = usePathValue((p) => {
    'worklet';
    p.reset();

    const w = width.value;
    if (w <= 0) return;

    const oscillation = Math.sin(
      transcribingTime.value * (Math.PI / 3.0) +
        profile.transcribingPhaseOffset,
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
    const dl = displayLevel.value;
    const frequencySqueeze = 1.0 + smoothedFreqLevel.value * 0.5;
    const distCenter = distortionCenter.value;
    const blipBoost = 1.0 + initialBlipAmount.value * 0.8;
    const edgePadding = Math.max(2, profile.strokeWidth);
    const maxAmplitude = Math.min(
      adjustedCenterY - edgePadding,
      height - adjustedCenterY - edgePadding,
    );
    const safeMaxAmplitude = maxAmplitude > 0 ? maxAmplitude : 0;

    let prevX = 0;
    let prevY = adjustedCenterY;

    for (let i = 0; i < POINTS; i++) {
      const normalizedX = i / POINTS_MINUS_ONE;
      const x = normalizedX * w;

      const distanceFromCenter = Math.abs(normalizedX - distCenter) * 2.0;
      const centerWeight = 1.0 - distanceFromCenter * distanceFromCenter * 0.6;
      const clampedCenterWeight =
        centerWeight < 0.3 ? 0.3 : centerWeight > 1.0 ? 1.0 : centerWeight;
      const positionWeight = 1.0 - posWeight * (1.0 - clampedCenterWeight);

      const rawAmplitude = baseEnergy * ampMult * positionWeight;
      const normalizedAmplitude =
        rawAmplitude < 0 ? 0 : rawAmplitude > 1 ? 1 : rawAmplitude;
      const recordingBoost =
        isRecording.value *
        dl *
        (RECORDING_AMPLITUDE_RANGE - BASE_AMPLITUDE_RANGE);
      const amplitudeRange = BASE_AMPLITUDE_RANGE + recordingBoost;
      let amplitude =
        MIN_AMPLITUDE + normalizedAmplitude * amplitudeRange * blipBoost;
      if (amplitude > safeMaxAmplitude) {
        amplitude = safeMaxAmplitude;
      }
      const sine = Math.sin(
        freqTwoPi * normalizedX * frequencySqueeze + currentPhase,
      );
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
          y,
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
  const isActive = useSharedValue(true);
  const initialBlipTarget = useSharedValue(Math.floor(Math.random() * 3));
  const hasTriggeredInitialBlip = useSharedValue(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const newStateNum = stateToNum(state);
    stateNum.value = newStateNum;
    // Reset blip state when entering recording/streaming mode
    if (
      state === TranscriptionState.RECORDING ||
      state === TranscriptionState.STREAMING
    ) {
      hasTriggeredInitialBlip.value = false;
      initialBlipTarget.value = Math.floor(Math.random() * 3);
    }
  }, [state, stateNum, hasTriggeredInitialBlip, initialBlipTarget]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      appStateRef.current = nextAppState;
      isActive.value = nextAppState === 'active';
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, [isActive]);

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
    [colors.accentBrand],
  );
  const color2Rgb = useMemo(() => hexToRgb(WAVE_COLORS[2]), []);

  const wave0 = useAnimatedWave(
    0,
    audioLevel,
    stateNum,
    containerWidth,
    height,
    centerY,
    color0Rgb,
    isActive,
    initialBlipTarget,
    hasTriggeredInitialBlip,
  );
  const wave1 = useAnimatedWave(
    1,
    audioLevel,
    stateNum,
    containerWidth,
    height,
    centerY,
    color1Rgb,
    isActive,
    initialBlipTarget,
    hasTriggeredInitialBlip,
  );
  const wave2 = useAnimatedWave(
    2,
    audioLevel,
    stateNum,
    containerWidth,
    height,
    centerY,
    color2Rgb,
    isActive,
    initialBlipTarget,
    hasTriggeredInitialBlip,
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
