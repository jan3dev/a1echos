import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppTheme, TranscriptionState } from '@/models';
import { AquaColors, getShadow, useThemeStore } from '@/theme';

import { Icon } from '../../ui/icon/Icon';

interface RecordingButtonProps {
  state?: TranscriptionState;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  enabled?: boolean;
  size?: number;
  scaleAnimationDuration?: number;
  glowAnimationDuration?: number;
  debounceDuration?: number;
  colors: AquaColors;
}

export const RecordingButton = ({
  state = TranscriptionState.READY,
  onRecordingStart,
  onRecordingStop,
  enabled = true,
  size = 64,
  scaleAnimationDuration = 250,
  glowAnimationDuration = 2000,
  debounceDuration = 800,
  colors,
}: RecordingButtonProps) => {
  const [isDebouncing, setIsDebouncing] = useState(false);
  const [gestureIsolationActive, setGestureIsolationActive] = useState(false);

  const { currentTheme } = useThemeStore();
  const blurTint = currentTheme === AppTheme.DARK ? 'light' : 'dark';

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureIsolationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const scaleAnimationDelayTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const pulseAnimationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const scale = useSharedValue(1);
  const glowProgress = useSharedValue(0);
  const isPulseAnimating = useRef(false);

  const SCALE_ANIMATION_DELAY = 300;
  const GESTURE_ISOLATION_DURATION = 2000;

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (gestureIsolationTimerRef.current)
        clearTimeout(gestureIsolationTimerRef.current);
      if (scaleAnimationDelayTimerRef.current)
        clearTimeout(scaleAnimationDelayTimerRef.current);
      if (pulseAnimationTimerRef.current)
        clearTimeout(pulseAnimationTimerRef.current);
    };
  }, []);

  const triggerDelayedScaleAnimation = useCallback(() => {
    if (scaleAnimationDelayTimerRef.current) {
      clearTimeout(scaleAnimationDelayTimerRef.current);
    }
    scaleAnimationDelayTimerRef.current = setTimeout(() => {
      scale.value = withTiming(1.15, {
        duration: scaleAnimationDuration,
        easing: Easing.out(Easing.ease),
      });
    }, SCALE_ANIMATION_DELAY);
  }, [scale, scaleAnimationDuration]);

  useEffect(() => {
    if (state === TranscriptionState.READY) {
      setGestureIsolationActive(false);
    }

    if (state === TranscriptionState.RECORDING) {
      triggerDelayedScaleAnimation();
      glowProgress.value = withRepeat(
        withTiming(1, {
          duration: glowAnimationDuration,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      );
    } else {
      if (scaleAnimationDelayTimerRef.current) {
        clearTimeout(scaleAnimationDelayTimerRef.current);
      }
      if (!isPulseAnimating.current) {
        scale.value = withTiming(1, {
          duration: scaleAnimationDuration,
          easing: Easing.out(Easing.ease),
        });
      }
      cancelAnimation(glowProgress);
      glowProgress.value = 0;
    }
  }, [
    state,
    glowAnimationDuration,
    glowProgress,
    scale,
    scaleAnimationDuration,
    triggerDelayedScaleAnimation,
  ]);

  const triggerScaleAnimation = () => {
    scale.value = withSequence(
      withTiming(1.15, {
        duration: scaleAnimationDuration,
        easing: Easing.out(Easing.ease),
      }),
      withTiming(1, {
        duration: scaleAnimationDuration,
        easing: Easing.out(Easing.ease),
      })
    );
  };

  const handleRecordingAction = async (action: () => void) => {
    if (gestureIsolationActive || isDebouncing) {
      return;
    }

    setIsDebouncing(true);
    setGestureIsolationActive(true);

    try {
      action();

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

  const handleStartRecording = () => {
    if (onRecordingStart) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      handleRecordingAction(onRecordingStart);
    }
  };

  const handleStopRecording = () => {
    if (onRecordingStop && !isDebouncing) {
      setIsDebouncing(true);
      isPulseAnimating.current = true;
      triggerScaleAnimation();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const pulseDuration = scaleAnimationDuration * 2;
      if (pulseAnimationTimerRef.current) {
        clearTimeout(pulseAnimationTimerRef.current);
      }
      pulseAnimationTimerRef.current = setTimeout(() => {
        isPulseAnimating.current = false;
        onRecordingStop();

        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          setIsDebouncing(false);
        }, debounceDuration);
      }, pulseDuration);
    }
  };

  const scaleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const renderButton = () => {
    switch (state) {
      case TranscriptionState.LOADING:
      case TranscriptionState.TRANSCRIBING:
        return renderTranscribingButton();
      case TranscriptionState.RECORDING:
        return renderRecordingButton();
      case TranscriptionState.READY:
      default:
        return renderReadyButton();
    }
  };

  const renderTranscribingButton = () => (
    <Animated.View
      style={[
        styles.buttonContainer,
        { width: size, height: size },
        styles.transcribingButton,
        { backgroundColor: colors.glassInverse },
      ]}
    >
      <BlurView
        intensity={80}
        tint={blurTint}
        style={[StyleSheet.absoluteFill, styles.blurContainer]}
      >
        <TouchableOpacity
          style={styles.buttonTouchable}
          disabled={true}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Transcribing"
        >
          <Icon name="mic" size={24} color={colors.textInverse} />
        </TouchableOpacity>
      </BlurView>
    </Animated.View>
  );

  const glowAnimatedStyle = useAnimatedStyle(() => {
    const glowOpacity = 0.3 + glowProgress.value * 0.4;
    const glowRadius = 24 + glowProgress.value * 16;

    return {
      shadowColor: colors.accentBrand,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: glowOpacity,
      shadowRadius: glowRadius,
      elevation: 10,
    };
  });

  const renderRecordingButton = () => {
    return (
      <Animated.View
        style={[
          styles.buttonContainer,
          { width: size, height: size },
          { backgroundColor: colors.accentBrand },
          glowAnimatedStyle,
        ]}
      >
        <TouchableOpacity
          style={styles.buttonTouchable}
          onPress={handleStopRecording}
          disabled={isDebouncing || gestureIsolationActive || !enabled}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Stop Recording"
        >
          <Icon name="rectangle" size={14} color={colors.textInverse} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderReadyButton = () => (
    <Animated.View
      style={[
        styles.buttonContainer,
        { width: size, height: size },
        styles.readyButton,
        { backgroundColor: colors.glassInverse },
      ]}
    >
      <BlurView
        intensity={80}
        tint={blurTint}
        style={[StyleSheet.absoluteFill, styles.blurContainer]}
      >
        <TouchableOpacity
          style={styles.buttonTouchable}
          onPress={handleStartRecording}
          disabled={isDebouncing || gestureIsolationActive || !enabled}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Start Recording"
        >
          <Icon name="mic" size={24} color={colors.textInverse} />
        </TouchableOpacity>
      </BlurView>
    </Animated.View>
  );

  return (
    <Animated.View style={scaleAnimatedStyle}>{renderButton()}</Animated.View>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    borderRadius: 1000,
    overflow: 'hidden',
  },
  blurContainer: {
    borderRadius: 1000,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcribingButton: {
    ...getShadow('recordingButton'),
    opacity: 0.5,
  },
  readyButton: {
    ...getShadow('recordingButton'),
  },
});
