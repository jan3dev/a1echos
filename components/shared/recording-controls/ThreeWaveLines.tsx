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
import { useEffect, useMemo } from "react";
import { AppState, AppStateStatus, StyleSheet, View } from "react-native";
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";

import { useTranscriptionStore } from "@/stores";
import { recordingGradient } from "@/theme";

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
const WAVE_OPACITY = 0.85;

const MASK_OPAQUE = "rgb(255, 255, 255)";
const MASK_CLEAR = "rgba(255, 255, 255, 0)";

const buildAlphaMaskColors = (alphas: number[]): string[] =>
  alphas.map((a) => (a === 1 ? MASK_OPAQUE : MASK_CLEAR));

// Per-wave alternation pattern: where the sharp stroke pass is opaque
// (`sharpVisible[i] = 1`) the blurred pass is transparent and vice-versa.
// Wave 1 is inverted so the three lines never soften at the same x.
interface WaveGradient {
  positions: number[];
  sharpVisible: number[];
}

const WAVE_GRADIENTS: WaveGradient[] = [
  {
    positions: [0, 0.18, 0.25, 0.4, 0.55, 0.75, 0.85, 1.0],
    sharpVisible: [1, 1, 0, 0, 1, 1, 0, 0],
  },
  {
    positions: [0, 0.2, 0.3, 0.5, 0.62, 0.78, 0.85, 1.0],
    sharpVisible: [0, 0, 1, 1, 0, 0, 1, 1],
  },
  {
    positions: [0, 0.32, 0.45, 0.58, 0.65, 0.72, 0.8, 0.92],
    sharpVisible: [1, 1, 0, 0, 1, 1, 0, 0],
  },
];

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
  sharpMask: string[];
  blurredMask: string[];
  positions: number[];
  containerWidth: { value: number };
  height: number;
  gradientStart: { x: number; y: number };
  gradientEnd: { value: { x: number; y: number } };
  colorGradientStart: { x: number; y: number };
  colorGradientEnd: { x: number; y: number };
}

const MaskedWave = ({
  path,
  strokeWidth,
  sharpMask,
  blurredMask,
  positions,
  containerWidth,
  height,
  gradientStart,
  gradientEnd,
  colorGradientStart,
  colorGradientEnd,
}: MaskedWaveProps) => {
  const renderStrokedPath = (blurred: boolean) => (
    <Path
      path={path}
      style="stroke"
      strokeWidth={strokeWidth}
      strokeCap="round"
      strokeJoin="round"
    >
      <LinearGradient
        start={colorGradientStart}
        end={colorGradientEnd}
        colors={recordingGradient.colors}
        positions={recordingGradient.locations}
      />
      {blurred && <BlurMask blur={2.5} style="normal" />}
    </Path>
  );

  const renderMask = (maskColors: string[], blurred: boolean) => (
    <Mask
      mode="alpha"
      mask={
        <Rect x={0} y={0} width={containerWidth} height={height}>
          <LinearGradient
            start={gradientStart}
            end={gradientEnd}
            colors={maskColors}
            positions={positions}
          />
        </Rect>
      }
    >
      {renderStrokedPath(blurred)}
    </Mask>
  );

  return (
    <Group opacity={WAVE_OPACITY}>
      {renderMask(sharpMask, false)}
      {renderMask(blurredMask, true)}
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

  // Per-wave horizontal alpha-mask color arrays: where the sharp pass
  // is opaque the blurred pass is transparent (and vice versa). Built
  // once per visibility pattern so the per-frame render stays
  // allocation-free.
  const wave0SharpMask = useMemo(
    () => buildAlphaMaskColors(WAVE_GRADIENTS[0].sharpVisible),
    [],
  );
  const wave0BlurredMask = useMemo(
    () =>
      buildAlphaMaskColors(WAVE_GRADIENTS[0].sharpVisible.map((a) => 1 - a)),
    [],
  );
  const wave1SharpMask = useMemo(
    () => buildAlphaMaskColors(WAVE_GRADIENTS[1].sharpVisible),
    [],
  );
  const wave1BlurredMask = useMemo(
    () =>
      buildAlphaMaskColors(WAVE_GRADIENTS[1].sharpVisible.map((a) => 1 - a)),
    [],
  );
  const wave2SharpMask = useMemo(
    () => buildAlphaMaskColors(WAVE_GRADIENTS[2].sharpVisible),
    [],
  );
  const wave2BlurredMask = useMemo(
    () =>
      buildAlphaMaskColors(WAVE_GRADIENTS[2].sharpVisible.map((a) => 1 - a)),
    [],
  );

  // Horizontal mask gradient endpoints follow the canvas width so the
  // alternation pattern scales with the container.
  const gradientStart = useMemo(() => vec(0, 0), []);
  const gradientEnd = useDerivedValue(() => vec(containerWidth.value, 0));
  // Vertical color gradient runs top-to-bottom across the canvas, so
  // every wave shares the purple → blue → peach palette regardless of
  // its individual vertical offset.
  const colorGradientStart = useMemo(() => vec(0, 0), []);
  const colorGradientEnd = useMemo(() => vec(0, height), [height]);

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
          {
            wave: wave0,
            sharp: wave0SharpMask,
            blurred: wave0BlurredMask,
            idx: 0,
          },
          {
            wave: wave1,
            sharp: wave1SharpMask,
            blurred: wave1BlurredMask,
            idx: 1,
          },
          {
            wave: wave2,
            sharp: wave2SharpMask,
            blurred: wave2BlurredMask,
            idx: 2,
          },
        ].map(({ wave, sharp, blurred, idx }) => (
          <MaskedWave
            key={idx}
            path={wave.path}
            strokeWidth={wave.strokeWidth}
            sharpMask={sharp}
            blurredMask={blurred}
            positions={WAVE_GRADIENTS[idx].positions}
            containerWidth={containerWidth}
            height={height}
            gradientStart={gradientStart}
            gradientEnd={gradientEnd}
            colorGradientStart={colorGradientStart}
            colorGradientEnd={colorGradientEnd}
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
