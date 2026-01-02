import {
  Canvas,
  PaintStyle,
  Path,
  Skia,
  StrokeCap,
  StrokeJoin,
} from '@shopify/react-native-skia';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
    amplitudeMultiplier: 0.53,
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

const WAVE_COLORS = [
  AquaPrimitiveColors.waveOrange,
  '', // Will use accent color
  AquaPrimitiveColors.waveCyan,
];

const hexToSkiaColor = (hex: string, opacity: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return Skia.Color(`rgba(${r}, ${g}, ${b}, ${opacity})`);
};

const stateToNum = (state: TranscriptionState): number => {
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

interface WaveState {
  phase: number;
  displayLevel: number;
  oscillationStrength: number;
  transcribingTime: number;
  smoothedBaseEnergy: number;
  smoothedAmplitudeMultiplier: number;
  smoothedOpacity: number;
  smoothedPositionWeight: number;
}

export const ThreeWaveLines = ({
  height = 42.0,
  colors,
  state = TranscriptionState.RECORDING,
}: ThreeWaveLinesProps) => {
  const [containerWidth, setContainerWidth] = useState(400);
  const [tick, setTick] = useState(0);

  const audioLevelRef = useRef(0);
  const stateNumRef = useRef(stateToNum(state));
  const paintsRef = useRef(
    WAVE_PROFILES.map((profile) => {
      const paint = Skia.Paint();
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(profile.strokeWidth);
      paint.setStrokeCap(StrokeCap.Round);
      paint.setStrokeJoin(StrokeJoin.Round);
      paint.setAntiAlias(true);
      return paint;
    })
  );
  const waveStatesRef = useRef<WaveState[]>(
    WAVE_PROFILES.map((profile, index) => ({
      phase: PHASE_OFFSETS[index],
      displayLevel: 0,
      oscillationStrength: 0,
      transcribingTime: 0,
      smoothedBaseEnergy: 0.5,
      smoothedAmplitudeMultiplier: profile.amplitudeMultiplier * 1.5,
      smoothedOpacity: 0.75,
      smoothedPositionWeight: 0,
    }))
  );

  useEffect(() => {
    stateNumRef.current = stateToNum(state);
  }, [state]);

  useEffect(() => {
    let prevLevel = useTranscriptionStore.getState().audioLevel;
    const unsubscribe = useTranscriptionStore.subscribe((zustandState) => {
      const level = zustandState.audioLevel;
      if (level !== prevLevel) {
        prevLevel = level;
        audioLevelRef.current = Math.min(1.0, Math.max(0.0, level));
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let frameId: number;
    let lastTime = 0;
    const targetInterval = 33;

    const animate = (currentTime: number) => {
      frameId = requestAnimationFrame(animate);

      if (currentTime - lastTime < targetInterval) {
        return;
      }
      lastTime = currentTime;

      const currentState = stateNumRef.current;
      const targetLevel = audioLevelRef.current;
      const isRecordingOrStreaming = currentState === 2 || currentState === 4;
      const isTranscribingOrLoading = currentState === 3 || currentState === 0;

      const waveStates = waveStatesRef.current;

      for (let waveIndex = 0; waveIndex < WAVE_PROFILES.length; waveIndex++) {
        const profile = WAVE_PROFILES[waveIndex];
        const ws = waveStates[waveIndex];

        const diff = targetLevel - ws.displayLevel;
        const alpha = diff > 0 ? 0.55 : 0.22;
        ws.displayLevel = ws.displayLevel + diff * alpha;

        let targetBaseEnergy: number;
        let targetAmplitudeMultiplier: number;
        let targetOpacity: number;
        let targetPositionWeight: number;

        if (currentState === 1) {
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
          const audioReactiveEnergy = Math.min(
            1.0,
            Math.max(0.0, ws.displayLevel)
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
          const audioBoost = ws.displayLevel * profile.audioOpacityReactivity;
          targetOpacity = Math.min(
            1.0,
            Math.max(baseOpacity, baseOpacity + audioBoost)
          );
          targetPositionWeight = 1;
        }

        const transitionSpeed = 0.15;
        ws.smoothedBaseEnergy +=
          (targetBaseEnergy - ws.smoothedBaseEnergy) * transitionSpeed;
        ws.smoothedAmplitudeMultiplier +=
          (targetAmplitudeMultiplier - ws.smoothedAmplitudeMultiplier) *
          transitionSpeed;
        ws.smoothedOpacity +=
          (targetOpacity - ws.smoothedOpacity) * transitionSpeed;
        ws.smoothedPositionWeight +=
          (targetPositionWeight - ws.smoothedPositionWeight) * transitionSpeed;

        if (isTranscribingOrLoading) {
          ws.transcribingTime += 0.033;
          if (ws.oscillationStrength < 1.0) {
            ws.oscillationStrength = Math.min(
              1.0,
              ws.oscillationStrength + 0.1
            );
          }
        } else {
          if (ws.oscillationStrength > 0.0) {
            ws.oscillationStrength = Math.max(
              0.0,
              ws.oscillationStrength - 0.1
            );
            if (ws.oscillationStrength <= 0) {
              ws.transcribingTime = 0;
            }
          }
        }

        let phaseStep: number;
        if (currentState === 1) {
          phaseStep = profile.basePhaseSpeed * 0.6;
        } else if (isRecordingOrStreaming) {
          const baseSpeed = profile.basePhaseSpeed * 4.8;
          const audioSpeedMultiplier =
            1.0 + ws.displayLevel * profile.audioSpeedReactivity;
          phaseStep = baseSpeed * audioSpeedMultiplier;
        } else {
          phaseStep = profile.basePhaseSpeed * 0.6;
        }
        ws.phase = (ws.phase + phaseStep) % (Math.PI * 2);
      }

      setTick((t) => t + 1);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const generateWavePath = (
    width: number,
    centerY: number,
    waveIndex: number
  ) => {
    const profile = WAVE_PROFILES[waveIndex];
    const ws = waveStatesRef.current[waveIndex];
    const path = Skia.Path.Make();

    const amplitudeRange = MAX_AMPLITUDE - MIN_AMPLITUDE;
    const pointsMinusOne = POINTS - 1;
    const freqTwoPi = profile.frequency * 2 * Math.PI;

    const oscillation = Math.sin(
      ws.transcribingTime * (Math.PI / 3.0) + profile.transcribingPhaseOffset
    );
    const phaseInversion = 1.0 + (oscillation - 1.0) * ws.oscillationStrength;

    const convergenceFactor = 1.0 - ws.displayLevel * 0.7;
    const dynamicVerticalOffset =
      profile.verticalOffset *
      (1.0 - ws.smoothedPositionWeight * (1.0 - convergenceFactor));
    const adjustedCenterY = centerY + dynamicVerticalOffset;

    const points: { x: number; y: number }[] = [];

    for (let i = 0; i < POINTS; i++) {
      const normalizedX = i / pointsMinusOne;
      const x = normalizedX * width;

      const distanceFromCenter = Math.abs(normalizedX - 0.5) * 2.0;
      const centerWeight = 1.0 - distanceFromCenter * distanceFromCenter * 0.5;
      const clampedCenterWeight =
        centerWeight < 0.4 ? 0.4 : centerWeight > 1.0 ? 1.0 : centerWeight;
      const positionWeight =
        1.0 - ws.smoothedPositionWeight * (1.0 - clampedCenterWeight);

      const rawAmplitude =
        ws.smoothedBaseEnergy * ws.smoothedAmplitudeMultiplier * positionWeight;
      const normalizedAmplitude =
        rawAmplitude < 0 ? 0 : rawAmplitude > 1 ? 1 : rawAmplitude;
      const amplitude = MIN_AMPLITUDE + normalizedAmplitude * amplitudeRange;
      const sine = Math.sin(freqTwoPi * normalizedX + ws.phase);
      const energyFactor = 0.65 + normalizedAmplitude * 0.35;
      const y =
        adjustedCenterY + amplitude * energyFactor * sine * phaseInversion;

      points.push({ x, y });
    }

    if (points.length > 0) {
      path.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const controlX1 = prev.x + (curr.x - prev.x) * 0.33;
        const controlX2 = prev.x + (curr.x - prev.x) * 0.66;
        const controlY1 = prev.y + (curr.y - prev.y) * 0.33;
        const controlY2 = prev.y + (curr.y - prev.y) * 0.66;
        path.cubicTo(
          controlX1,
          controlY1,
          controlX2,
          controlY2,
          curr.x,
          curr.y
        );
      }
    }

    return path;
  };

  const getWaveColor = (waveIndex: number) => {
    const ws = waveStatesRef.current[waveIndex];
    const colorHex =
      waveIndex === 1 ? colors.accentBrand : WAVE_COLORS[waveIndex];
    return hexToSkiaColor(colorHex, ws.smoothedOpacity);
  };

  // Force re-read on tick change
  void tick;

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
      <Canvas style={styles.canvas}>
        {WAVE_PROFILES.map((_, index) => {
          const path = generateWavePath(containerWidth, height / 2, index);
          const paint = paintsRef.current[index];
          paint.setColor(getWaveColor(index));

          return <Path key={index} path={path} paint={paint} />;
        })}
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
