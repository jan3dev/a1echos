import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { TranscriptionState } from '../../../models/TranscriptionState';
import { AquaPrimitiveColors } from '../../../theme/colors';
import { AquaColors } from '../../../theme/themeColors';

interface ThreeWaveLinesProps {
  audioLevel?: number;
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

interface WaveState {
  profile: WaveProfile;
  data: number[];
  targets: number[];
  phase: number;
}

const TOTAL_DATA_POINTS = 120;

// Match Flutter's wave profiles exactly
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
    amplitudeMultiplier: 0.75,
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

const PHASE_OFFSETS = [0.0, Math.PI, Math.PI * 2];

const hexToRgba = (hex: string, opacity: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const ThreeWaveLines = ({
  audioLevel = 0.0,
  height = 42.0,
  colors,
  state = TranscriptionState.RECORDING,
}: ThreeWaveLinesProps) => {
  const [, forceUpdate] = useState(0);
  const [containerWidth, setContainerWidth] = useState(400);
  const wavesRef = useRef<WaveState[]>([]);
  const displayLevelRef = useRef(audioLevel);
  const targetLevelRef = useRef(audioLevel);
  const stateRef = useRef(state);
  const colorsRef = useRef(colors);
  const transcribingInversionTimeRef = useRef(0.0);
  const oscillationStrengthRef = useRef(0.0);
  const animationFrameRef = useRef<number | null>(null);
  const maxAmplitude = 20.0;
  const minAmplitude = 2.0;
  const minNormalizedAmplitude = minAmplitude / maxAmplitude;

  // Keep refs in sync with props
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    colorsRef.current = colors;
  }, [colors]);

  const initializeWaves = useCallback(() => {
    const initialValue = minNormalizedAmplitude;

    wavesRef.current = WAVE_PROFILES.map((profile, index) => ({
      profile,
      data: Array(TOTAL_DATA_POINTS).fill(initialValue),
      targets: Array(TOTAL_DATA_POINTS).fill(initialValue),
      phase: PHASE_OFFSETS[index % PHASE_OFFSETS.length],
    }));

    generateNewTargets(stateRef.current);
    wavesRef.current.forEach((wave) => {
      for (let i = 0; i < TOTAL_DATA_POINTS; i++) {
        wave.data[i] = wave.targets[i];
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startWaveAnimation = useCallback(() => {
    const animate = () => {
      updateWaveform();
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    initializeWaves();
    startWaveAnimation();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [initializeWaves, startWaveAnimation]);

  // Animate audio level changes with easing (like Flutter's _animateTo)
  useEffect(() => {
    targetLevelRef.current = Math.min(1.0, Math.max(0.0, audioLevel));
  }, [audioLevel]);

  const updateWaveform = () => {
    const currentState = stateRef.current;

    // Smoothly animate displayLevel toward targetLevel (easeOutCubic-like)
    const target = targetLevelRef.current;
    const current = displayLevelRef.current;
    const diff = target - current;
    // Faster rise, slower fall (like Flutter)
    const speed = diff > 0 ? 0.25 : 0.15;
    displayLevelRef.current = current + diff * speed;

    if (
      currentState === TranscriptionState.TRANSCRIBING ||
      currentState === TranscriptionState.LOADING
    ) {
      transcribingInversionTimeRef.current += 0.016;
      if (oscillationStrengthRef.current < 1.0) {
        oscillationStrengthRef.current += 0.05;
        if (oscillationStrengthRef.current > 1.0)
          oscillationStrengthRef.current = 1.0;
      }
    } else {
      if (oscillationStrengthRef.current > 0.0) {
        oscillationStrengthRef.current -= 0.05;
        if (oscillationStrengthRef.current < 0.0) {
          oscillationStrengthRef.current = 0.0;
          transcribingInversionTimeRef.current = 0.0;
        }
      } else {
        transcribingInversionTimeRef.current = 0.0;
      }
    }

    wavesRef.current.forEach((wave) => {
      const phaseStep = calculatePhaseStep(wave.profile, currentState);
      wave.phase = (wave.phase + phaseStep) % (Math.PI * 2);
    });

    generateNewTargets(currentState);
    animateTowardsTargets();

    forceUpdate((n) => n + 1);
  };

  const calculatePhaseStep = (
    profile: WaveProfile,
    currentState: TranscriptionState
  ): number => {
    switch (currentState) {
      case TranscriptionState.READY:
        return profile.basePhaseSpeed * 0.3;

      case TranscriptionState.RECORDING:
      case TranscriptionState.STREAMING: {
        // Match Flutter: basePhaseSpeed * 4.0, scaled by audio
        const baseSpeed = profile.basePhaseSpeed * 4.0;
        const audioSpeedMultiplier =
          1.0 + displayLevelRef.current * profile.audioSpeedReactivity;
        return baseSpeed * audioSpeedMultiplier;
      }

      case TranscriptionState.TRANSCRIBING:
      case TranscriptionState.LOADING:
        return profile.basePhaseSpeed * 0.3;

      default:
        return profile.basePhaseSpeed * 0.3;
    }
  };

  const generateNewTargets = (currentState: TranscriptionState) => {
    const isRecordingOrStreaming =
      currentState === TranscriptionState.RECORDING ||
      currentState === TranscriptionState.STREAMING;

    wavesRef.current.forEach((wave) => {
      const profile = wave.profile;
      for (let i = 0; i < TOTAL_DATA_POINTS; i++) {
        const baseEnergy = getBaseEnergyForState(profile, currentState);
        const positionWeight = isRecordingOrStreaming
          ? getPositionWeight(i / (TOTAL_DATA_POINTS - 1))
          : 1.0;
        const stateAmplitudeMultiplier = getStateAmplitudeMultiplier(
          profile,
          currentState
        );

        const target = Math.min(
          1.0,
          Math.max(0.0, baseEnergy * stateAmplitudeMultiplier * positionWeight)
        );

        const previousTarget = wave.targets[i];
        // Match Flutter: 0.85 * prev + 0.15 * target
        const smoothedTarget = previousTarget * 0.85 + target * 0.15;

        wave.targets[i] = Math.max(
          minNormalizedAmplitude,
          Math.min(1.0, smoothedTarget)
        );
      }
    });
  };

  const getBaseEnergyForState = (
    profile: WaveProfile,
    currentState: TranscriptionState
  ): number => {
    switch (currentState) {
      case TranscriptionState.READY:
        // Match Flutter: fixed 0.5 for ready state
        return 0.5;

      case TranscriptionState.TRANSCRIBING:
      case TranscriptionState.LOADING:
        return 1.0;

      case TranscriptionState.RECORDING:
      case TranscriptionState.STREAMING: {
        // Match Flutter exactly
        const audioReactiveEnergy = Math.min(
          1.0,
          Math.max(0.0, displayLevelRef.current)
        );
        const blendedEnergy =
          profile.energyFloor +
          audioReactiveEnergy * profile.audioAmplitudeReactivity;
        return Math.min(1.0, Math.max(profile.energyFloor, blendedEnergy));
      }

      default:
        return 0.5;
    }
  };

  const getStateAmplitudeMultiplier = (
    profile: WaveProfile,
    currentState: TranscriptionState
  ): number => {
    switch (currentState) {
      case TranscriptionState.READY:
        // Match Flutter: amplitudeMultiplier * 1.5 for ready state
        return profile.amplitudeMultiplier * 1.5;

      case TranscriptionState.TRANSCRIBING:
      case TranscriptionState.LOADING:
        return profile.transcribingAmplitude;

      case TranscriptionState.RECORDING:
      case TranscriptionState.STREAMING:
        // Match Flutter: just amplitudeMultiplier for recording
        return profile.amplitudeMultiplier;

      default:
        return profile.amplitudeMultiplier;
    }
  };

  const animateTowardsTargets = () => {
    wavesRef.current.forEach((wave) => {
      for (let i = 0; i < TOTAL_DATA_POINTS; i++) {
        const diff = wave.targets[i] - wave.data[i];
        const speed = 0.2;
        wave.data[i] = Math.min(
          1.0,
          Math.max(minNormalizedAmplitude, wave.data[i] + diff * speed)
        );
      }
    });
  };

  const getPositionWeight = (position: number): number => {
    // Match Flutter exactly
    const distanceFromCenter = Math.abs(position - 0.5) * 2.0;
    const centerWeight = 1.0 - distanceFromCenter * distanceFromCenter * 0.5;
    return Math.min(1.0, Math.max(0.4, centerWeight));
  };

  const calculateDynamicVerticalOffset = (
    baseOffset: number,
    currentState: TranscriptionState
  ): number => {
    if (
      currentState !== TranscriptionState.RECORDING &&
      currentState !== TranscriptionState.STREAMING
    ) {
      return baseOffset;
    }
    // Match Flutter: convergence factor based on audio level
    const convergenceFactor = 1.0 - displayLevelRef.current * 0.7;
    return baseOffset * convergenceFactor;
  };

  const resolveWaveColor = (
    index: number,
    currentState: TranscriptionState
  ): string => {
    const profile = wavesRef.current[index].profile;
    const currentColors = colorsRef.current;

    let stateOpacity: number;
    if (
      currentState === TranscriptionState.TRANSCRIBING ||
      currentState === TranscriptionState.LOADING
    ) {
      stateOpacity = 0.5;
    } else if (
      currentState === TranscriptionState.RECORDING ||
      currentState === TranscriptionState.STREAMING
    ) {
      // Match Flutter exactly
      const baseOpacity = 0.75;
      const maxOpacity = 1.0;
      const audioBoost =
        displayLevelRef.current * profile.audioOpacityReactivity;
      stateOpacity = Math.min(
        maxOpacity,
        Math.max(baseOpacity, baseOpacity + audioBoost)
      );
    } else {
      stateOpacity = 0.75;
    }

    switch (index) {
      case 0:
        return hexToRgba(AquaPrimitiveColors.waveOrange, stateOpacity);
      case 1:
        return hexToRgba(currentColors.accentBrand, stateOpacity);
      case 2:
        return hexToRgba(AquaPrimitiveColors.waveCyan, stateOpacity);
      default:
        return hexToRgba(currentColors.accentBrand, stateOpacity);
    }
  };

  const generateWavePath = (
    wave: WaveState,
    width: number,
    centerY: number,
    currentState: TranscriptionState
  ): string => {
    if (wave.data.length === 0) return '';

    const profile = wave.profile;
    const points = wave.data.length;
    const amplitudeRange = maxAmplitude - minAmplitude;

    // Match Flutter's phase inversion calculation
    const oscillation = Math.sin(
      transcribingInversionTimeRef.current * (Math.PI / 3.0) +
        profile.transcribingPhaseOffset
    );
    const individualPhaseInversion =
      1.0 + (oscillation - 1.0) * oscillationStrengthRef.current;

    const dynamicVerticalOffset = calculateDynamicVerticalOffset(
      profile.verticalOffset,
      currentState
    );
    const adjustedCenterY = centerY + dynamicVerticalOffset;

    let path = '';

    for (let i = 0; i < points; i++) {
      const normalizedX = i / (points - 1);
      const x = normalizedX * width;

      const normalizedAmplitude = Math.min(1.0, Math.max(0.0, wave.data[i]));
      const amplitude = minAmplitude + normalizedAmplitude * amplitudeRange;
      const sine = Math.sin(
        profile.frequency * 2 * Math.PI * normalizedX + wave.phase
      );
      const energyFactor = 0.65 + normalizedAmplitude * 0.35;
      const y =
        adjustedCenterY +
        amplitude * energyFactor * sine * individualPhaseInversion;

      if (i === 0) {
        path += `M${x},${y}`;
      } else {
        const prevNormalizedX = (i - 1) / (points - 1);
        const prevX = prevNormalizedX * width;
        const prevNormalizedAmplitude = Math.min(
          1.0,
          Math.max(0.0, wave.data[i - 1])
        );
        const prevAmplitude =
          minAmplitude + prevNormalizedAmplitude * amplitudeRange;
        const prevSine = Math.sin(
          profile.frequency * 2 * Math.PI * prevNormalizedX + wave.phase
        );
        const prevEnergyFactor = 0.65 + prevNormalizedAmplitude * 0.35;
        const prevY =
          adjustedCenterY +
          prevAmplitude *
            prevEnergyFactor *
            prevSine *
            individualPhaseInversion;

        const controlX1 = prevX + (x - prevX) * 0.33;
        const controlX2 = prevX + (x - prevX) * 0.66;
        const controlY1 = prevY + (y - prevY) * 0.33;
        const controlY2 = prevY + (y - prevY) * 0.66;

        path += ` C${controlX1},${controlY1} ${controlX2},${controlY2} ${x},${y}`;
      }
    }

    return path;
  };

  // Use current state from ref for rendering
  const currentState = stateRef.current;

  return (
    <View
      style={[styles.container, { height }]}
      onLayout={(event) => {
        const { width } = event.nativeEvent.layout;
        if (width > 0 && width !== containerWidth) {
          setContainerWidth(width);
        }
      }}
    >
      <Svg width="100%" height={height} style={styles.svg}>
        {wavesRef.current.map((wave, index) => (
          <Path
            key={index}
            d={generateWavePath(wave, containerWidth, height / 2, currentState)}
            stroke={resolveWaveColor(index, currentState)}
            strokeWidth={wave.profile.strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  svg: {
    width: '100%',
    height: '100%',
  },
});
