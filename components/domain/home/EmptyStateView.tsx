import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Tooltip } from '../../ui/tooltip/Tooltip';

interface EmptyStateViewProps {
  message: string;
  shouldDisappear: boolean;
  onDisappearComplete?: () => void;
}

export const EmptyStateView = ({
  message,
  shouldDisappear,
  onDisappearComplete,
}: EmptyStateViewProps) => {
  const bounceY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    // Continuous bounce animation
    bounceY.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 1000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
  }, [bounceY]);

  useEffect(() => {
    if (shouldDisappear) {
      scale.value = withTiming(0, { duration: 250 }, (finished) => {
        if (finished && onDisappearComplete) {
          scheduleOnRN(onDisappearComplete);
        }
      });
      opacity.value = withTiming(0, { duration: 200 });
    } else {
      scale.value = withSpring(1);
      opacity.value = withSpring(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldDisappear]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: bounceY.value }, { scale: scale.value }],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Tooltip
        visible={true}
        message={message}
        pointerPosition="bottom"
        margin={0}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
});
