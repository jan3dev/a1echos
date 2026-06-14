import {
  BlurMask,
  Canvas,
  Group,
  LinearGradient,
  Mask,
  Path,
  Rect,
  usePathValue,
  vec,
} from "@shopify/react-native-skia";
import { useEffect } from "react";
import {
  AppState,
  AppStateStatus,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";

import { useTranscriptionStore } from "@/stores";
import { recordingWaveGradients } from "@/theme";

interface ThreeWaveLinesProps {
  height?: number;
}

interface WaveProfile {
  basePhaseSpeed: number;
  frequency: number;
  verticalOffset: number;
  amplitudeMultiplier: number;
  strokeWidth: number;
  energyFloor: number;
  audioAmplitudeReactivity: number;
}

const WAVE_PROFILES: WaveProfile[] = [
  {
    basePhaseSpeed: 0.04,
    frequency: 2.2,
    verticalOffset: -3.2,
    amplitudeMultiplier: 0.35,
    strokeWidth: 3,
    energyFloor: 0.06,
    audioAmplitudeReactivity: 0.7,
  },
  {
    basePhaseSpeed: 0.07,
    frequency: 3.1,
    verticalOffset: 0,
    amplitudeMultiplier: 0.55,
    strokeWidth: 3,
    energyFloor: 0.05,
    audioAmplitudeReactivity: 1.0,
  },
  {
    basePhaseSpeed: 0.09,
    frequency: 2.5,
    verticalOffset: 3.6,
    amplitudeMultiplier: 0.75,
    strokeWidth: 3,
    energyFloor: 0.04,
    audioAmplitudeReactivity: 0.55,
  },
];

const PHASE_OFFSETS = [0, Math.PI, Math.PI * 2];
const POINTS = 60;
const BASE_MAX_AMPLITUDE = 20;
const RECORDING_MAX_AMPLITUDE = 32;
const MIN_AMPLITUDE = 2;
const BASE_AMPLITUDE_RANGE = BASE_MAX_AMPLITUDE - MIN_AMPLITUDE;
const RECORDING_AMPLITUDE_RANGE = RECORDING_MAX_AMPLITUDE - MIN_AMPLITUDE;
const POINTS_MINUS_ONE = POINTS - 1;
const VOICE_THRESHOLD = 0.38;
const WAVE_OPACITY = 1.0;

// Each wave crossfades between a crisp copy and a single blurred copy along the
// horizontal axis. Skia has no variable blur, so the blur lives in fixed
// segments per line: `alphas` is the reveal of the blurred copy (1 = fully
// blurred) at each normalized x in `positions`, and the crisp copy is revealed
// by the complement (1 - alpha). LinearGradient interpolates between stops for a
// smooth soft↔crisp transition and clamps beyond its endpoints.
const END_BLUR = Platform.OS === "android" ? 1.8 : 2.5;

interface BlurReveal {
  positions: number[];
  alphas: number[];
}

// The outer lines (0, 2) soften at both ends and stay crisp through the middle;
// the middle line (1) softens through the center and stays crisp at the ends.
const WAVE_BLUR_REVEALS: BlurReveal[] = [
  { positions: [0, 0.32, 0.68, 1], alphas: [1, 0, 0, 1] },
  { positions: [0, 0.34, 0.66, 1], alphas: [0, 1, 1, 0] },
  { positions: [0, 0.32, 0.68, 1], alphas: [1, 0, 0, 1] },
];

const alphaMaskColor = (a: number) => `rgba(255, 255, 255, ${a})`;

const useAnimatedWave = (
  waveIndex: number,
  audioLevel: { value: number },
  width: { value: number },
  height: number,
  centerY: number,
  isActive: { value: boolean },
  initialBlipTarget: { value: number },
  hasTriggeredInitialBlip: { value: boolean },
) => {
  const profile = WAVE_PROFILES[waveIndex];
  const freqTwoPi = profile.frequency * 2 * Math.PI;

  const phase = useSharedValue(PHASE_OFFSETS[waveIndex]);
  const displayLevel = useSharedValue(0);
  const initialBlipAmount = useSharedValue(0);
  const smoothedFreqLevel = useSharedValue(0);
  const distortionCenter = useSharedValue(0.5);
  const smoothedBaseEnergy = useSharedValue(profile.energyFloor);
  const smoothedAmplitudeMultiplier = useSharedValue(
    profile.amplitudeMultiplier,
  );
  const phaseSpeedMultiplier = useSharedValue(0.6);

  useFrameCallback((frameInfo) => {
    "worklet";
    if (!isActive.value) return;

    const dt = frameInfo.timeSincePreviousFrame ?? 33;
    const dtFactor = dt / 33;

    const targetLevel = audioLevel.value;

    if (
      !hasTriggeredInitialBlip.value &&
      targetLevel > VOICE_THRESHOLD &&
      initialBlipTarget.value === waveIndex
    ) {
      initialBlipAmount.value = 5.0;
      hasTriggeredInitialBlip.value = true;
    }

    if (initialBlipAmount.value > 0) {
      initialBlipAmount.value *= 0.94;
      if (initialBlipAmount.value < 0.02) {
        initialBlipAmount.value = 0;
      }
    }

    const diff = targetLevel - displayLevel.value;
    const lerpSpeed = diff > 0 ? 0.08 : 0.04;
    displayLevel.value += diff * lerpSpeed * dtFactor;
    if (displayLevel.value > 1.4) displayLevel.value = 1.4;
    if (displayLevel.value < 0) displayLevel.value = 0;

    const targetSpeedMult = 1.0 + displayLevel.value * 4.5;
    phaseSpeedMultiplier.value +=
      (targetSpeedMult - phaseSpeedMultiplier.value) * 0.08 * dtFactor;

    smoothedFreqLevel.value +=
      (displayLevel.value - smoothedFreqLevel.value) * 0.05 * dtFactor;

    const dl = displayLevel.value;
    const voiceBoost =
      dl > VOICE_THRESHOLD
        ? (dl - VOICE_THRESHOLD) * 0.5 * profile.audioAmplitudeReactivity
        : 0;
    const audioReactiveEnergy = dl < 0 ? 0 : dl > 1 ? 1 : dl;
    let targetBaseEnergy =
      profile.energyFloor +
      audioReactiveEnergy * profile.audioAmplitudeReactivity +
      voiceBoost;
    if (targetBaseEnergy > 1.2) targetBaseEnergy = 1.2;

    const adjustedSpeed = 0.08 * dtFactor;
    smoothedBaseEnergy.value +=
      (targetBaseEnergy - smoothedBaseEnergy.value) * adjustedSpeed;
    smoothedAmplitudeMultiplier.value +=
      (profile.amplitudeMultiplier - smoothedAmplitudeMultiplier.value) *
      adjustedSpeed;

    if (displayLevel.value > 0.2) {
      const targetCenter = 0.5 + (Math.random() - 0.5) * 0.04;
      const clampedTarget =
        targetCenter < 0.35 ? 0.35 : targetCenter > 0.65 ? 0.65 : targetCenter;
      distortionCenter.value +=
        (clampedTarget - distortionCenter.value) * 0.02 * dtFactor;
    } else {
      distortionCenter.value +=
        (0.5 - distortionCenter.value) * 0.03 * dtFactor;
    }

    const phaseStep =
      profile.basePhaseSpeed * phaseSpeedMultiplier.value * dtFactor;
    phase.value = (phase.value + phaseStep) % (Math.PI * 2);
  });

  const path = usePathValue((p) => {
    "worklet";
    p.reset();

    const w = width.value;
    if (w <= 0) return;

    const dl = displayLevel.value;
    const convergenceFactor = 1.0 - dl * 0.7;
    const adjustedCenterY =
      centerY + profile.verticalOffset * convergenceFactor;

    const baseEnergy = smoothedBaseEnergy.value;
    const ampMult = smoothedAmplitudeMultiplier.value;
    const currentPhase = phase.value;
    const frequencySqueeze = 1.0 + smoothedFreqLevel.value * 0.5;
    const distCenter = distortionCenter.value;
    const blipAmount = initialBlipAmount.value;
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
      const positionWeight =
        centerWeight < 0.3 ? 0.3 : centerWeight > 1.0 ? 1.0 : centerWeight;

      const rawAmplitude = baseEnergy * ampMult * positionWeight;
      const normalizedAmplitude =
        rawAmplitude < 0 ? 0 : rawAmplitude > 1 ? 1 : rawAmplitude;
      const amplitudeRange =
        BASE_AMPLITUDE_RANGE +
        dl * (RECORDING_AMPLITUDE_RANGE - BASE_AMPLITUDE_RANGE);

      const blipCenter = 0.8;
      const blipWidth = 0.35;
      const distFromBlipCenter = Math.abs(normalizedX - blipCenter);
      const blipFalloff =
        distFromBlipCenter < blipWidth
          ? 1.0 - distFromBlipCenter / blipWidth
          : 0;
      const blipAddition =
        blipAmount * RECORDING_MAX_AMPLITUDE * 1.2 * blipFalloff;

      let amplitude =
        MIN_AMPLITUDE + normalizedAmplitude * amplitudeRange + blipAddition;
      if (amplitude > safeMaxAmplitude) {
        amplitude = safeMaxAmplitude;
      }
      const sine = Math.sin(
        freqTwoPi * normalizedX * frequencySqueeze + currentPhase,
      );
      const energyFactor = 0.65 + normalizedAmplitude * 0.35;
      const y = adjustedCenterY + amplitude * energyFactor * sine;

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

  return { path, strokeWidth: profile.strokeWidth };
};

interface MaskedWaveProps {
  path: ReturnType<typeof usePathValue>;
  strokeWidth: number;
  reveal: BlurReveal;
  containerWidth: { value: number };
  height: number;
  gradientColors: string[];
  gradientLocations: number[];
}

const MaskedWave = ({
  path,
  strokeWidth,
  reveal,
  containerWidth,
  height,
  gradientColors,
  gradientLocations,
}: MaskedWaveProps) => {
  const centerY = height / 2;
  // Blur reveal runs left → right across the full width; positions are
  // fractions of that span.
  const maskStart = useDerivedValue(() => vec(0, centerY));
  const maskEnd = useDerivedValue(() => vec(containerWidth.value, centerY));

  // Horizontal color gradient: each wave spans the full purple → blue → orange
  // palette along its length, so the colors read regardless of amplitude.
  const colorStart = useDerivedValue(() => vec(0, 0));
  const colorEnd = useDerivedValue(() => vec(containerWidth.value, 0));

  const blurColors = reveal.alphas.map(alphaMaskColor);
  const sharpColors = reveal.alphas.map((a) => alphaMaskColor(1 - a));

  const renderCopy = (blur: number) => (
    <Path
      path={path}
      style="stroke"
      strokeWidth={strokeWidth}
      strokeCap="round"
      strokeJoin="round"
    >
      <LinearGradient
        start={colorStart}
        end={colorEnd}
        colors={gradientColors}
        positions={gradientLocations}
      />
      {blur > 0 && <BlurMask blur={blur} style="normal" />}
    </Path>
  );

  return (
    <Group opacity={WAVE_OPACITY}>
      <Mask
        mode="alpha"
        mask={
          <Rect x={0} y={0} width={containerWidth} height={height}>
            <LinearGradient
              start={maskStart}
              end={maskEnd}
              colors={blurColors}
              positions={reveal.positions}
            />
          </Rect>
        }
      >
        {renderCopy(END_BLUR)}
      </Mask>
      <Mask
        mode="alpha"
        mask={
          <Rect x={0} y={0} width={containerWidth} height={height}>
            <LinearGradient
              start={maskStart}
              end={maskEnd}
              colors={sharpColors}
              positions={reveal.positions}
            />
          </Rect>
        }
      >
        {renderCopy(0)}
      </Mask>
    </Group>
  );
};

export const ThreeWaveLines = ({ height = 42 }: ThreeWaveLinesProps) => {
  const containerWidth = useSharedValue(400);
  const audioLevel = useSharedValue(0);
  const isActive = useSharedValue(AppState.currentState === "active");
  const initialBlipTarget = useSharedValue(Math.floor(Math.random() * 3));
  const hasTriggeredInitialBlip = useSharedValue(false);

  useEffect(() => {
    hasTriggeredInitialBlip.value = false;
    initialBlipTarget.value = Math.floor(Math.random() * 3);
  }, [hasTriggeredInitialBlip, initialBlipTarget]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      isActive.value = nextAppState === "active";
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, [isActive]);

  useEffect(() => {
    let prevLevel = useTranscriptionStore.getState().audioLevel;
    const updateAudioLevel = (level: number) => {
      "worklet";
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

  const wave0 = useAnimatedWave(
    0,
    audioLevel,
    containerWidth,
    height,
    centerY,
    isActive,
    initialBlipTarget,
    hasTriggeredInitialBlip,
  );
  const wave1 = useAnimatedWave(
    1,
    audioLevel,
    containerWidth,
    height,
    centerY,
    isActive,
    initialBlipTarget,
    hasTriggeredInitialBlip,
  );
  const wave2 = useAnimatedWave(
    2,
    audioLevel,
    containerWidth,
    height,
    centerY,
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
        {[
          { wave: wave0, idx: 0 },
          { wave: wave1, idx: 1 },
          { wave: wave2, idx: 2 },
        ].map(({ wave, idx }) => (
          <MaskedWave
            key={idx}
            path={wave.path}
            strokeWidth={wave.strokeWidth}
            reveal={WAVE_BLUR_REVEALS[idx]}
            containerWidth={containerWidth}
            height={height}
            gradientColors={recordingWaveGradients[idx].colors}
            gradientLocations={recordingWaveGradients[idx].locations}
          />
        ))}
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  canvas: {
    flex: 1,
  },
});
