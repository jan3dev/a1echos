import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  AppState,
  AppStateStatus,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { TestID } from "@/constants";
import { TranscriptionState } from "@/models";
import { AquaColors, lightColors, recordingGradient } from "@/theme";

import { Icon } from "../../ui/icon/Icon";
import { ProgressIndicator } from "../../ui/progress/ProgressIndicator";

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

const GRADIENT_ROTATION_PERIOD_MS = 6000;
const PRESS_DOWN_SCALE = 0.9;
const IDLE_RING_THICKNESS = 10;
const IDLE_RING_RADIUS = 300;
// Tuck the ring's inner edge slightly under the button so the two visually
// connect instead of leaving a hairline gap at the seam.
const IDLE_RING_OVERLAP = 2;
const GESTURE_ISOLATION_DURATION = 2000;
const EASE_OUT = Easing.out(Easing.ease);

// Oversized so the gradient corners never expose the underlying surface as
// the layer rotates inside the circular clip.
const GRADIENT_OVERSIZE_FACTOR = 1.5;

const RotatingGradientCircle = ({ size }: { size: number }) => {
  const rotation = useSharedValue(0);

  const frameCallback = useFrameCallback((frameInfo) => {
    "worklet";
    const dt = Math.min(frameInfo.timeSincePreviousFrame ?? 16, 50);
    rotation.value =
      (rotation.value + (dt / GRADIENT_ROTATION_PERIOD_MS) * 360) % 360;
  });

  useEffect(() => {
    const handleChange = (next: AppStateStatus) => {
      frameCallback.setActive(next === "active");
    };
    frameCallback.setActive(AppState.currentState === "active");
    const sub = AppState.addEventListener("change", handleChange);
    return () => sub.remove();
  }, [frameCallback]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const oversize = size * GRADIENT_OVERSIZE_FACTOR;
  const offset = (oversize - size) / 2;

  return (
    <View
      pointerEvents="none"
      style={{
        ...StyleSheet.absoluteFill,
        borderRadius: size / 2,
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={[
          {
            position: "absolute",
            width: oversize,
            height: oversize,
            top: -offset,
            left: -offset,
          },
          animatedStyle,
        ]}
      >
        <LinearGradient
          colors={
            recordingGradient.colors as unknown as readonly [
              string,
              string,
              ...string[],
            ]
          }
          locations={
            recordingGradient.locations as unknown as readonly [
              number,
              number,
              ...number[],
            ]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </View>
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

  const renderButton = () => {
    if (state === TranscriptionState.RECORDING_STARTING) {
      return renderSpinnerButton(
        TestID.RecordingButtonStarting,
        "Preparing recording",
      );
    }
    if (
      isInitializing &&
      (state === TranscriptionState.READY || state === TranscriptionState.ERROR)
    ) {
      return renderSpinnerButton(
        TestID.RecordingButtonStarting,
        "Preparing recording",
      );
    }
    switch (state) {
      case TranscriptionState.LOADING:
      case TranscriptionState.TRANSCRIBING:
        return renderSpinnerButton(
          TestID.RecordingButtonTranscribing,
          "Transcribing",
        );
      case TranscriptionState.RECORDING:
        return renderRecordingButton();
      case TranscriptionState.READY:
      default:
        return renderReadyButton();
    }
  };

  const circleSize = { width: size, height: size };
  const surfaceFill = { backgroundColor: colors.surfacePrimary };

  const renderReadyButton = () => (
    <View style={styles.readyContainer}>
      <View
        pointerEvents="none"
        style={[
          styles.idleRing,
          {
            width: size + (IDLE_RING_THICKNESS - IDLE_RING_OVERLAP) * 2,
            height: size + (IDLE_RING_THICKNESS - IDLE_RING_OVERLAP) * 2,
            borderColor: colors.glassSurface,
          },
        ]}
      />
      <View style={[styles.buttonContainer, circleSize]}>
        <RotatingGradientCircle size={size} />
        <TouchableOpacity
          testID={TestID.RecordingButtonStart}
          style={styles.buttonTouchable}
          onPress={handleStartRecording}
          disabled={isDebouncing || gestureIsolationActive || !enabled}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Start Recording"
        >
          <Icon name="mic" size={24} color={lightColors.textInverse} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRecordingButton = () => (
    <View style={[styles.buttonContainer, circleSize, surfaceFill]}>
      <TouchableOpacity
        testID={TestID.RecordingButtonStop}
        style={styles.buttonTouchable}
        onPress={handleStopRecording}
        disabled={isDebouncing || gestureIsolationActive || !enabled}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Stop Recording"
      >
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
      </TouchableOpacity>
    </View>
  );

  const renderSpinnerButton = (testID: string, label: string) => (
    <View style={[styles.buttonContainer, circleSize, surfaceFill]}>
      <TouchableOpacity
        testID={testID}
        style={styles.buttonTouchable}
        disabled={true}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: true, busy: true }}
      >
        <ProgressIndicator color={colors.textTertiary} size={24} />
      </TouchableOpacity>
    </View>
  );

  return (
    <Animated.View style={scaleAnimatedStyle}>{renderButton()}</Animated.View>
  );
};

const styles = StyleSheet.create({
  readyContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  idleRing: {
    position: "absolute",
    borderRadius: IDLE_RING_RADIUS,
    borderWidth: IDLE_RING_THICKNESS,
  },
  buttonContainer: {
    borderRadius: 1000,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  buttonTouchable: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
});
