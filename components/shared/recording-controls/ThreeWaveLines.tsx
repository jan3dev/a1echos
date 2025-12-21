import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedProps,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { TranscriptionState } from '@/models';
import { AquaColors, AquaPrimitiveColors } from '@/theme';

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
const POINTS = 60;
const MAX_AMPLITUDE = 20.0;
const MIN_AMPLITUDE = 2.0;

const AnimatedPath = Animated.createAnimatedComponent(Path);

const hexToRgba = (hex: string, opacity: number): string => {
  'worklet';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const generateWavePath = (
  width: number,
  centerY: number,
  phase: number,
  displayLevel: number,
  oscillationStrength: number,
  transcribingTime: number,
  profile: WaveProfile,
  baseEnergy: number,
  amplitudeMultiplier: number,
  positionWeightEnabled: number
): string => {
  'worklet';
  const amplitudeRange = MAX_AMPLITUDE - MIN_AMPLITUDE;
  const pointsMinusOne = POINTS - 1;
  const freqTwoPi = profile.frequency * 2 * Math.PI;

  const oscillation = Math.sin(
    transcribingTime * (Math.PI / 3.0) + profile.transcribingPhaseOffset
  );
  const phaseInversion = 1.0 + (oscillation - 1.0) * oscillationStrength;

  const convergenceFactor = 1.0 - displayLevel * 0.7;
  const dynamicVerticalOffset =
    profile.verticalOffset *
    (1.0 - positionWeightEnabled * (1.0 - convergenceFactor));
  const adjustedCenterY = centerY + dynamicVerticalOffset;

  const parts: string[] = new Array(POINTS);

  for (let i = 0; i < POINTS; i++) {
    const normalizedX = i / pointsMinusOne;
    const x = normalizedX * width;

    const distanceFromCenter = Math.abs(normalizedX - 0.5) * 2.0;
    const centerWeight = 1.0 - distanceFromCenter * distanceFromCenter * 0.5;
    const clampedCenterWeight =
      centerWeight < 0.4 ? 0.4 : centerWeight > 1.0 ? 1.0 : centerWeight;
    const positionWeight =
      1.0 - positionWeightEnabled * (1.0 - clampedCenterWeight);

    const rawAmplitude = baseEnergy * amplitudeMultiplier * positionWeight;
    const normalizedAmplitude =
      rawAmplitude < 0 ? 0 : rawAmplitude > 1 ? 1 : rawAmplitude;
    const amplitude = MIN_AMPLITUDE + normalizedAmplitude * amplitudeRange;
    const sine = Math.sin(freqTwoPi * normalizedX + phase);
    const energyFactor = 0.65 + normalizedAmplitude * 0.35;
    const y =
      adjustedCenterY + amplitude * energyFactor * sine * phaseInversion;

    const xRounded = Math.round(x * 10) / 10;
    const yRounded = Math.round(y * 10) / 10;

    if (i === 0) {
      parts[i] = `M${xRounded},${yRounded}`;
    } else {
      parts[i] = `L${xRounded},${yRounded}`;
    }
  }

  return parts.join(' ');
};

const stateToNum = (state: TranscriptionState): number => {
  'worklet';
  switch (state) {
    case TranscriptionState.LOADING:
      return 0;
    case TranscriptionState.READY:
      return 1;
    case TranscriptionState.RECORDING:
      return 2;
    case TranscriptionState.TRANSCRIBING:
      return 3;
    case TranscriptionState.STREAMING:
      return 4;
    case TranscriptionState.ERROR:
      return 5;
    default:
      return 1;
  }
};

interface AnimatedWaveProps {
  profile: WaveProfile;
  initialPhase: number;
  width: number;
  height: number;
  audioLevelSV: SharedValue<number>;
  stateSV: SharedValue<number>;
  accentColor: string;
  waveIndex: number;
}

const AnimatedWave = ({
  profile,
  initialPhase,
  width,
  height,
  audioLevelSV,
  stateSV,
  accentColor,
  waveIndex,
}: AnimatedWaveProps) => {
  const phase = useSharedValue(initialPhase);
  const displayLevel = useSharedValue(0);
  const oscillationStrength = useSharedValue(0);
  const transcribingTime = useSharedValue(0);
  const smoothedBaseEnergy = useSharedValue(0.5);
  const smoothedAmplitudeMultiplier = useSharedValue(
    profile.amplitudeMultiplier * 1.5
  );
  const smoothedOpacity = useSharedValue(0.75);
  const smoothedPositionWeight = useSharedValue(0);
  const frameCount = useSharedValue(0);

  useFrameCallback(() => {
    // Skip every other frame for ~30fps
    frameCount.value = (frameCount.value + 1) % 2;
    if (frameCount.value !== 0) return;
    const currentState = stateSV.value;
    const targetLevel = audioLevelSV.value;
    const isRecordingOrStreaming = currentState === 2 || currentState === 4;
    const isTranscribingOrLoading = currentState === 3 || currentState === 0;

    // Faster attack, moderate release for responsiveness (doubled for 30fps)
    const diff = targetLevel - displayLevel.value;
    const alpha = diff > 0 ? 0.55 : 0.22;
    displayLevel.value = displayLevel.value + diff * alpha;

    // Calculate target values based on state
    let targetBaseEnergy: number;
    let targetAmplitudeMultiplier: number;
    let targetOpacity: number;

    let targetPositionWeight: number;

    if (currentState === 1) {
      // READY
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
      // RECORDING or STREAMING
      const audioReactiveEnergy = Math.min(
        1.0,
        Math.max(0.0, displayLevel.value)
      );
      targetBaseEnergy = Math.min(
        1.0,
        Math.max(
          profile.energyFloor,
          profile.energyFloor +
            audioReactiveEnergy * profile.audioAmplitudeReactivity
        )
      );
      targetAmplitudeMultiplier = profile.amplitudeMultiplier;
      const baseOpacity = 0.75;
      const audioBoost = displayLevel.value * profile.audioOpacityReactivity;
      targetOpacity = Math.min(
        1.0,
        Math.max(baseOpacity, baseOpacity + audioBoost)
      );
      targetPositionWeight = 1;
    }

    // Smooth transitions between states (doubled for 30fps)
    const transitionSpeed = 0.15;
    smoothedBaseEnergy.value +=
      (targetBaseEnergy - smoothedBaseEnergy.value) * transitionSpeed;
    smoothedAmplitudeMultiplier.value +=
      (targetAmplitudeMultiplier - smoothedAmplitudeMultiplier.value) *
      transitionSpeed;
    smoothedOpacity.value +=
      (targetOpacity - smoothedOpacity.value) * transitionSpeed;
    smoothedPositionWeight.value +=
      (targetPositionWeight - smoothedPositionWeight.value) * transitionSpeed;

    // Oscillation for transcribing state (doubled for 30fps)
    if (isTranscribingOrLoading) {
      transcribingTime.value += 0.033;
      if (oscillationStrength.value < 1.0) {
        oscillationStrength.value = Math.min(
          1.0,
          oscillationStrength.value + 0.1
        );
      }
    } else {
      if (oscillationStrength.value > 0.0) {
        oscillationStrength.value = Math.max(
          0.0,
          oscillationStrength.value - 0.1
        );
        if (oscillationStrength.value <= 0) {
          transcribingTime.value = 0;
        }
      }
    }

    // Phase animation (doubled for 30fps)
    let phaseStep: number;
    if (currentState === 1) {
      // READY
      phaseStep = profile.basePhaseSpeed * 0.6;
    } else if (isRecordingOrStreaming) {
      const baseSpeed = profile.basePhaseSpeed * 4.0;
      const audioSpeedMultiplier =
        1.0 + displayLevel.value * profile.audioSpeedReactivity;
      phaseStep = baseSpeed * audioSpeedMultiplier;
    } else {
      phaseStep = profile.basePhaseSpeed * 0.6;
    }
    phase.value = (phase.value + phaseStep) % (Math.PI * 2);
  });

  const animatedProps = useAnimatedProps(() => {
    let strokeColor: string;
    if (waveIndex === 0) {
      strokeColor = hexToRgba(
        AquaPrimitiveColors.waveOrange,
        smoothedOpacity.value
      );
    } else if (waveIndex === 1) {
      strokeColor = hexToRgba(accentColor, smoothedOpacity.value);
    } else {
      strokeColor = hexToRgba(
        AquaPrimitiveColors.waveCyan,
        smoothedOpacity.value
      );
    }

    const d = generateWavePath(
      width,
      height / 2,
      phase.value,
      displayLevel.value,
      oscillationStrength.value,
      transcribingTime.value,
      profile,
      smoothedBaseEnergy.value,
      smoothedAmplitudeMultiplier.value,
      smoothedPositionWeight.value
    );

    return {
      d,
      stroke: strokeColor,
    };
  });

  return (
    <AnimatedPath
      animatedProps={animatedProps}
      strokeWidth={profile.strokeWidth}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
};

export const ThreeWaveLines = ({
  audioLevel = 0.0,
  height = 42.0,
  colors,
  state = TranscriptionState.RECORDING,
}: ThreeWaveLinesProps) => {
  const [containerWidth, setContainerWidth] = useState(400);
  const audioLevelSV = useSharedValue(audioLevel);
  const stateSV = useSharedValue(stateToNum(state));

  useEffect(() => {
    audioLevelSV.value = Math.min(1.0, Math.max(0.0, audioLevel));
  }, [audioLevel, audioLevelSV]);

  useEffect(() => {
    stateSV.value = stateToNum(state);
  }, [state, stateSV]);

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
        {WAVE_PROFILES.map((profile, index) => (
          <AnimatedWave
            key={index}
            profile={profile}
            initialPhase={PHASE_OFFSETS[index]}
            width={containerWidth}
            height={height}
            audioLevelSV={audioLevelSV}
            stateSV={stateSV}
            accentColor={colors.accentBrand}
            waveIndex={index}
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
