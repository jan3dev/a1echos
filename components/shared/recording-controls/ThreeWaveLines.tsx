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
import { useEffect, useMemo, useRef } from "react";
import { AppState, AppStateStatus, StyleSheet, View } from "react-native";
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";

import { TranscriptionState } from "@/models";
import { useTranscriptionStore } from "@/stores";

interface ThreeWaveLinesProps {
  height?: number;
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
    strokeWidth: 3.0,
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
    strokeWidth: 3.0,
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

/// Shared vertical color gradient applied to every wave — replaces the
/// previous per-wave orange / accent / cyan palette. Stops mirror the
/// Figma SVG (`#A54CFF → #4588D2 → #FBCAB9` from top to bottom).
const WAVE_GRADIENT_COLORS = ["#A54CFF", "#4588D2", "#FBCAB9"];
const WAVE_GRADIENT_STOPS = [0, 0.5, 1.0];

const MASK_OPAQUE = "rgb(255, 255, 255)";
const MASK_CLEAR = "rgba(255, 255, 255, 0)";

const buildAlphaMaskColors = (alphas: number[]): string[] =>
  alphas.map((a) => (a === 1 ? MASK_OPAQUE : MASK_CLEAR));

/// Per-wave horizontal gradient stops + visibility pattern controlling
/// which segments of the wave render as a sharp 3pt stroke vs. a
/// Gaussian-blurred stroke. Each wave has TWO blurred spots at
/// distinctly different x positions so the three lines never all soften
/// at the same place.
///
/// `sharpVisible[i] = 1` means the sharp pass is opaque at `positions[i]`
/// (and the blurred pass is transparent there). `0` means the inverse.
/// Wave 1 uses an inverted pattern so its first blur lands on the
/// far-left, where the others stay crisp.
///
/// Approximate blur centers:
///   Wave 0 (orange): ~32%, ~92%
///   Wave 1 (blue) : ~10%, ~70%  (inverted pattern)
///   Wave 2 (cyan) : ~51%, ~88%
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

const stateToNum = (state: TranscriptionState): number => {
  "worklet";
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

const useAnimatedWave = (
  waveIndex: number,
  audioLevel: { value: number },
  stateNum: { value: number },
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

  useFrameCallback((frameInfo) => {
    "worklet";
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
        initialBlipAmount.value = 5.0;
        hasTriggeredInitialBlip.value = true;
      }

      // Decay the initial blip (slower decay to stay longer)
      if (initialBlipAmount.value > 0) {
        initialBlipAmount.value *= 0.94;
        if (initialBlipAmount.value < 0.02) {
          initialBlipAmount.value = 0;
        }
      }

      // Smooth envelope following - slow attack, slower release
      // This creates a stable amplitude that represents overall volume
      const diff = targetLevel - displayLevel.value;
      const lerpSpeed = diff > 0 ? 0.08 : 0.04;
      displayLevel.value += diff * lerpSpeed * dtFactor;
      if (displayLevel.value > 1.4) displayLevel.value = 1.4;
      if (displayLevel.value < 0) displayLevel.value = 0;

      // Smoothly adjust phase speed based on display level
      const targetSpeedMult = 1.0 + displayLevel.value * 4.5;
      phaseSpeedMultiplier.value +=
        (targetSpeedMult - phaseSpeedMultiplier.value) * 0.08 * dtFactor;
    } else {
      isRecording.value = 0;
      const diff = targetLevel - displayLevel.value;
      displayLevel.value += diff * (diff > 0 ? 0.1 : 0.06) * dtFactor;
      initialBlipAmount.value = 0;

      // Gradually slow down phase speed when not recording
      phaseSpeedMultiplier.value +=
        (0.6 - phaseSpeedMultiplier.value) * 0.04 * dtFactor;
    }

    prevAudioLevel.value = targetLevel;

    const freqTarget = isRecordingOrStreaming ? displayLevel.value : 0;
    smoothedFreqLevel.value +=
      (freqTarget - smoothedFreqLevel.value) * 0.05 * dtFactor;

    let targetBaseEnergy: number;
    let targetAmplitudeMultiplier: number;
    let targetOpacity: number;
    let targetPositionWeight: number;

    if (currentState === STATE_NUM.READY) {
      targetBaseEnergy = 0.5;
      targetAmplitudeMultiplier = profile.amplitudeMultiplier * 1.5;
      targetOpacity = 0.8;
      targetPositionWeight = 0;
    } else if (isTranscribingOrLoading) {
      targetBaseEnergy = 1.0;
      targetAmplitudeMultiplier = profile.transcribingAmplitude;
      targetOpacity = 0.4;
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
      targetOpacity = 0.8;
      targetPositionWeight = 1;
    }

    // Smooth transitions for stable wave behavior
    const transitionSpeed = isRecordingOrStreaming ? 0.08 : 0.1;
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

    // Smoothly drift distortion center during recording
    if (isRecordingOrStreaming && displayLevel.value > 0.2) {
      const targetCenter = 0.5 + (Math.random() - 0.5) * 0.04;
      const clampedTarget =
        targetCenter < 0.35 ? 0.35 : targetCenter > 0.65 ? 0.65 : targetCenter;
      distortionCenter.value +=
        (clampedTarget - distortionCenter.value) * 0.02 * dtFactor;
    } else {
      distortionCenter.value +=
        (0.5 - distortionCenter.value) * 0.03 * dtFactor;
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
    "worklet";
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

      // Apply blip centered around 45% of the wave, fading out to edges
      // Blip adds amplitude directly so it's visible even when displayLevel is low
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

  // Group-level opacity drives the entire wave's alpha so the shared
  // vertical color gradient below can stay at full alpha and still
  // scale with recording state via this single multiplier.
  const groupOpacity = useDerivedValue(() => smoothedOpacity.value);

  return { path, groupOpacity, strokeWidth: profile.strokeWidth };
};

export const ThreeWaveLines = ({
  height = 42.0,
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
    stateNum,
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
    stateNum,
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
    stateNum,
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
        {/* Each wave renders two stroked passes — one sharp, one with
            `BlurMask blur={2.5}` — gated by opposing horizontal alpha
            masks (`<Mask mode="alpha">`). Both passes share the same
            vertical color gradient (`#A54CFF → #4588D2 → #FBCAB9`),
            applied through a `<LinearGradient>` shader on each path so
            the colors remain consistent across waves while only the
            blurred segments differ per wave. */}
        <Group opacity={wave0.groupOpacity}>
          <Mask
            mode="alpha"
            mask={
              <Rect x={0} y={0} width={containerWidth} height={height}>
                <LinearGradient
                  start={gradientStart}
                  end={gradientEnd}
                  colors={wave0SharpMask}
                  positions={WAVE_GRADIENTS[0].positions}
                />
              </Rect>
            }
          >
            <Path
              path={wave0.path}
              style="stroke"
              strokeWidth={wave0.strokeWidth}
              strokeCap="round"
              strokeJoin="round"
            >
              <LinearGradient
                start={colorGradientStart}
                end={colorGradientEnd}
                colors={WAVE_GRADIENT_COLORS}
                positions={WAVE_GRADIENT_STOPS}
              />
            </Path>
          </Mask>
          <Mask
            mode="alpha"
            mask={
              <Rect x={0} y={0} width={containerWidth} height={height}>
                <LinearGradient
                  start={gradientStart}
                  end={gradientEnd}
                  colors={wave0BlurredMask}
                  positions={WAVE_GRADIENTS[0].positions}
                />
              </Rect>
            }
          >
            <Path
              path={wave0.path}
              style="stroke"
              strokeWidth={wave0.strokeWidth}
              strokeCap="round"
              strokeJoin="round"
            >
              <LinearGradient
                start={colorGradientStart}
                end={colorGradientEnd}
                colors={WAVE_GRADIENT_COLORS}
                positions={WAVE_GRADIENT_STOPS}
              />
              <BlurMask blur={2.5} style="normal" />
            </Path>
          </Mask>
        </Group>
        <Group opacity={wave1.groupOpacity}>
          <Mask
            mode="alpha"
            mask={
              <Rect x={0} y={0} width={containerWidth} height={height}>
                <LinearGradient
                  start={gradientStart}
                  end={gradientEnd}
                  colors={wave1SharpMask}
                  positions={WAVE_GRADIENTS[1].positions}
                />
              </Rect>
            }
          >
            <Path
              path={wave1.path}
              style="stroke"
              strokeWidth={wave1.strokeWidth}
              strokeCap="round"
              strokeJoin="round"
            >
              <LinearGradient
                start={colorGradientStart}
                end={colorGradientEnd}
                colors={WAVE_GRADIENT_COLORS}
                positions={WAVE_GRADIENT_STOPS}
              />
            </Path>
          </Mask>
          <Mask
            mode="alpha"
            mask={
              <Rect x={0} y={0} width={containerWidth} height={height}>
                <LinearGradient
                  start={gradientStart}
                  end={gradientEnd}
                  colors={wave1BlurredMask}
                  positions={WAVE_GRADIENTS[1].positions}
                />
              </Rect>
            }
          >
            <Path
              path={wave1.path}
              style="stroke"
              strokeWidth={wave1.strokeWidth}
              strokeCap="round"
              strokeJoin="round"
            >
              <LinearGradient
                start={colorGradientStart}
                end={colorGradientEnd}
                colors={WAVE_GRADIENT_COLORS}
                positions={WAVE_GRADIENT_STOPS}
              />
              <BlurMask blur={2.5} style="normal" />
            </Path>
          </Mask>
        </Group>
        <Group opacity={wave2.groupOpacity}>
          <Mask
            mode="alpha"
            mask={
              <Rect x={0} y={0} width={containerWidth} height={height}>
                <LinearGradient
                  start={gradientStart}
                  end={gradientEnd}
                  colors={wave2SharpMask}
                  positions={WAVE_GRADIENTS[2].positions}
                />
              </Rect>
            }
          >
            <Path
              path={wave2.path}
              style="stroke"
              strokeWidth={wave2.strokeWidth}
              strokeCap="round"
              strokeJoin="round"
            >
              <LinearGradient
                start={colorGradientStart}
                end={colorGradientEnd}
                colors={WAVE_GRADIENT_COLORS}
                positions={WAVE_GRADIENT_STOPS}
              />
            </Path>
          </Mask>
          <Mask
            mode="alpha"
            mask={
              <Rect x={0} y={0} width={containerWidth} height={height}>
                <LinearGradient
                  start={gradientStart}
                  end={gradientEnd}
                  colors={wave2BlurredMask}
                  positions={WAVE_GRADIENTS[2].positions}
                />
              </Rect>
            }
          >
            <Path
              path={wave2.path}
              style="stroke"
              strokeWidth={wave2.strokeWidth}
              strokeCap="round"
              strokeJoin="round"
            >
              <LinearGradient
                start={colorGradientStart}
                end={colorGradientEnd}
                colors={WAVE_GRADIENT_COLORS}
                positions={WAVE_GRADIENT_STOPS}
              />
              <BlurMask blur={2.5} style="normal" />
            </Path>
          </Mask>
        </Group>
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
