import * as Haptics from "expo-haptics";
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  RadialGradient,
  Rect,
  rect,
  rrect,
} from "@shopify/react-native-skia";
import { useEffect, useRef, useState } from "react";
import {
  AppState,
  AppStateStatus,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { TestID } from "@/constants";
import { TranscriptionState } from "@/models";
import {
  AquaColors,
  lightColors,
  recordingButtonGradient,
  RecordingButtonBlob,
  RecordingButtonHighlight,
} from "@/theme";

import { Icon } from "../../ui/icon/Icon";

interface RecordingButtonProps {
  state?: TranscriptionState;
  isInitializing?: boolean;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  enabled?: boolean;
  size?: number;
  scaleAnimationDuration?: number;
  debounceDuration?: number;
  colors: AquaColors;
}

const PRESS_DOWN_SCALE = 0.9;
const GESTURE_ISOLATION_DURATION = 2000;
const EASE_OUT = Easing.out(Easing.ease);

const GRADIENT = recordingButtonGradient;
const GRADIENT_ORIGIN = GRADIENT.viewBox / 2 - GRADIENT.maskRadius;

const GRADIENT_TRANSITION_MS = 450;
const CONTENT_FADE_MS = 200;

const PROCESSING_PERIOD_MS = 3600;
const PROCESSING_MIN_OPACITY = 0.25;
const PROCESSING_VIEWBOX_WIDTH = 68;
const PROCESSING_VIEWBOX_HEIGHT = 96;
// Flat-edged half ellipses, smallest to largest; brightness sweeps left→right.
const PROCESSING_PATHS = [
  "M0 29A15 19 0 0 1 0 67Z",
  "M20 11A19 37 0 0 1 20 85Z",
  "M45 0A23 48 0 0 1 45 96Z",
];

const ProcessingArc = ({
  d,
  index,
  progress,
  color,
  width,
  height,
}: {
  d: string;
  index: number;
  progress: SharedValue<number>;
  color: string;
  width: number;
  height: number;
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    const phase = progress.value - index / PROCESSING_PATHS.length;
    const wave = 0.5 + 0.5 * Math.cos(2 * Math.PI * phase);
    return {
      opacity: PROCESSING_MIN_OPACITY + (1 - PROCESSING_MIN_OPACITY) * wave,
    };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${PROCESSING_VIEWBOX_WIDTH} ${PROCESSING_VIEWBOX_HEIGHT}`}
      >
        <Path d={d} fill={color} />
      </Svg>
    </Animated.View>
  );
};

const ProcessingIcon = ({ size, color }: { size: number; color: string }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: PROCESSING_PERIOD_MS,
        easing: Easing.linear,
      }),
      -1,
    );
  }, [progress]);

  const width = (size * PROCESSING_VIEWBOX_WIDTH) / PROCESSING_VIEWBOX_HEIGHT;

  return (
    <View testID="processing-icon" style={{ width, height: size }}>
      {PROCESSING_PATHS.map((d, index) => (
        <ProcessingArc
          key={d}
          d={d}
          index={index}
          progress={progress}
          color={color}
          width={width}
          height={size}
        />
      ))}
    </View>
  );
};

const GradientBlob = ({
  blob,
  size,
  progress,
}: {
  blob: RecordingButtonBlob;
  size: number;
  progress: SharedValue<number>;
}) => {
  const unit = size / (2 * GRADIENT.maskRadius);
  const c = useDerivedValue(() => {
    const angle = 2 * Math.PI * progress.value;
    return {
      x: size / 2 + unit * blob.r * Math.sin(blob.kx * angle + blob.phase),
      y:
        size / 2 + unit * blob.r * Math.sin(blob.ky * angle + blob.phase * 1.3),
    };
  });

  return (
    <Rect x={0} y={0} width={size} height={size}>
      <RadialGradient
        c={c}
        r={unit * blob.radius}
        colors={[`rgba(${blob.rgb},1)`, `rgba(${blob.rgb},0)`]}
      />
    </Rect>
  );
};

const GradientHighlight = ({
  highlight,
  size,
  progress,
}: {
  highlight: RecordingButtonHighlight;
  size: number;
  progress: SharedValue<number>;
}) => {
  const unit = size / (2 * GRADIENT.maskRadius);
  const c = useDerivedValue(() => {
    const angle =
      2 * Math.PI * highlight.revolutions * progress.value +
      (highlight.phaseDeg * Math.PI) / 180;
    return {
      x:
        unit *
        (highlight.x - GRADIENT_ORIGIN + highlight.orbit * Math.cos(angle)),
      y:
        unit *
        (highlight.y - GRADIENT_ORIGIN + highlight.orbit * Math.sin(angle)),
    };
  });

  return (
    <Circle c={c} r={unit * highlight.radius} color="white">
      <BlurMask blur={unit * highlight.blur} style="normal" />
    </Circle>
  );
};

const AnimatedGradientCircle = ({
  size,
  active,
}: {
  size: number;
  active: boolean;
}) => {
  const progress = useSharedValue(0);

  const frameCallback = useFrameCallback((frameInfo) => {
    "worklet";
    const dt = Math.min(frameInfo.timeSincePreviousFrame ?? 16, 50);
    progress.value = (progress.value + dt / GRADIENT.loopMs) % 1;
  });

  useEffect(() => {
    const handleChange = (next: AppStateStatus) => {
      frameCallback.setActive(active && next === "active");
    };
    handleChange(AppState.currentState);
    const sub = AppState.addEventListener("change", handleChange);
    return () => sub.remove();
  }, [active, frameCallback]);

  return (
    // Skia's surface ignores the parent View's rounded clip on iOS.
    <Canvas
      pointerEvents="none"
      style={{ position: "absolute", width: size, height: size }}
    >
      <Group clip={rrect(rect(0, 0, size, size), size / 2, size / 2)}>
        <Rect x={0} y={0} width={size} height={size} color={GRADIENT.base} />
        {GRADIENT.blobs.map((blob) => (
          <GradientBlob
            key={blob.rgb}
            blob={blob}
            size={size}
            progress={progress}
          />
        ))}
        <Group opacity={GRADIENT.highlightStrength}>
          {GRADIENT.highlights.map((highlight) => (
            <GradientHighlight
              key={`${highlight.x},${highlight.y}`}
              highlight={highlight}
              size={size}
              progress={progress}
            />
          ))}
        </Group>
      </Group>
    </Canvas>
  );
};

export const RecordingButton = ({
  state = TranscriptionState.READY,
  isInitializing = false,
  onRecordingStart,
  onRecordingStop,
  enabled = true,
  size = 80,
  scaleAnimationDuration = 250,
  debounceDuration = 800,
  colors,
}: RecordingButtonProps) => {
  const [isDebouncing, setIsDebouncing] = useState(false);
  const [gestureIsolationActive, setGestureIsolationActive] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureIsolationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pressActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const scale = useSharedValue(1);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (gestureIsolationTimerRef.current)
        clearTimeout(gestureIsolationTimerRef.current);
      if (pressActionTimerRef.current)
        clearTimeout(pressActionTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (state === TranscriptionState.READY) {
      if (gestureIsolationTimerRef.current) {
        clearTimeout(gestureIsolationTimerRef.current);
        gestureIsolationTimerRef.current = null;
      }
      setGestureIsolationActive(false);
    }
  }, [state]);

  const triggerPressTransition = (action: () => void) => {
    scale.value = withSequence(
      withTiming(PRESS_DOWN_SCALE, {
        duration: scaleAnimationDuration,
        easing: EASE_OUT,
      }),
      withTiming(1, { duration: scaleAnimationDuration, easing: EASE_OUT }),
    );

    if (pressActionTimerRef.current) {
      clearTimeout(pressActionTimerRef.current);
    }
    pressActionTimerRef.current = setTimeout(action, scaleAnimationDuration);
  };

  const handleStartRecording = () => {
    if (!onRecordingStart || gestureIsolationActive || isDebouncing) {
      return;
    }

    setIsDebouncing(true);
    setGestureIsolationActive(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      triggerPressTransition(onRecordingStart);

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        setIsDebouncing(false);
      }, debounceDuration);

      if (gestureIsolationTimerRef.current)
        clearTimeout(gestureIsolationTimerRef.current);
      gestureIsolationTimerRef.current = setTimeout(() => {
        setGestureIsolationActive(false);
      }, GESTURE_ISOLATION_DURATION);
    } catch {
      setIsDebouncing(false);
      setGestureIsolationActive(false);
    }
  };

  const handleStopRecording = () => {
    if (!onRecordingStop || isDebouncing) {
      return;
    }

    setIsDebouncing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    triggerPressTransition(() => {
      onRecordingStop();

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        setIsDebouncing(false);
      }, debounceDuration);
    });
  };

  const scaleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isBusy =
    state === TranscriptionState.RECORDING_STARTING ||
    state === TranscriptionState.LOADING ||
    state === TranscriptionState.TRANSCRIBING ||
    (isInitializing &&
      (state === TranscriptionState.READY ||
        state === TranscriptionState.ERROR));
  const isRecording = !isBusy && state === TranscriptionState.RECORDING;
  const isReady = !isBusy && !isRecording;

  const busyLabel =
    state === TranscriptionState.LOADING ||
    state === TranscriptionState.TRANSCRIBING
      ? "Transcribing"
      : "Preparing recording";
  const busyTestID =
    busyLabel === "Transcribing"
      ? TestID.RecordingButtonTranscribing
      : TestID.RecordingButtonStarting;

  // 0 = gradient fills the button, 1 = surface disc has pushed it out past
  // the edge. Driven by shared values so a mid-transition state change reverses
  // smoothly instead of waiting for the previous animation.
  const reveal = useSharedValue(isReady ? 0 : 1);

  useEffect(() => {
    reveal.value = withTiming(isReady ? 0 : 1, {
      duration: GRADIENT_TRANSITION_MS,
      easing: EASE_OUT,
    });
  }, [isReady, reveal]);

  const surfaceDiscStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reveal.value }],
  }));

  const circleSize = { width: size, height: size };
  // Slightly larger than the clip so no gradient fringe survives at the edge.
  const discSize = size + 2;

  const renderContent = () => {
    if (isRecording) {
      return (
        <View
          style={{
            shadowColor: colors.accentDanger,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6,
            shadowRadius: 24,
            elevation: 12,
          }}
        >
          <Icon name="rectangle" size={24} color={colors.accentDanger} />
        </View>
      );
    }
    if (isBusy) {
      return <ProcessingIcon size={24} color={colors.textTertiary} />;
    }
    return <Icon name="mic" size={24} color={lightColors.textInverse} />;
  };

  return (
    <LayoutAnimationConfig skipEntering>
      <Animated.View style={scaleAnimatedStyle}>
        <TouchableOpacity
          testID={
            isBusy
              ? busyTestID
              : isRecording
                ? TestID.RecordingButtonStop
                : TestID.RecordingButtonStart
          }
          style={[styles.touchable, circleSize]}
          onPress={
            isBusy
              ? undefined
              : isRecording
                ? handleStopRecording
                : handleStartRecording
          }
          disabled={
            isBusy || isDebouncing || gestureIsolationActive || !enabled
          }
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={
            isBusy
              ? busyLabel
              : isRecording
                ? "Stop Recording"
                : "Start Recording"
          }
          accessibilityState={
            isBusy ? { disabled: true, busy: true } : undefined
          }
        >
          <View style={[styles.buttonContainer, circleSize]}>
            <AnimatedGradientCircle size={size} active={isReady} />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.surfaceDisc,
                {
                  width: discSize,
                  height: discSize,
                  backgroundColor: colors.surfacePrimary,
                },
                surfaceDiscStyle,
              ]}
            />
            {!isReady && (
              <View
                pointerEvents="none"
                style={[
                  styles.border,
                  { borderColor: colors.glassSurfaceBorder },
                ]}
              />
            )}
            <Animated.View
              key={isRecording ? "stop" : isBusy ? "busy" : "mic"}
              entering={FadeIn.duration(CONTENT_FADE_MS).delay(CONTENT_FADE_MS)}
              exiting={FadeOut.duration(CONTENT_FADE_MS)}
            >
              {renderContent()}
            </Animated.View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </LayoutAnimationConfig>
  );
};

const styles = StyleSheet.create({
  touchable: {
    alignItems: "center",
    justifyContent: "center",
  },
  surfaceDisc: {
    position: "absolute",
    borderRadius: 1000,
  },
  buttonContainer: {
    borderRadius: 1000,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 1000,
    borderWidth: 1,
  },
});
