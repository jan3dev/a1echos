import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Icon } from '../icon';

interface ProgressIndicatorProps {
  color?: string;
  size?: number;
}

export const ProgressIndicator = ({
  color,
  size = 24,
}: ProgressIndicatorProps) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [rotateAnim]);

  const rotate = React.useMemo(
    () =>
      rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
      }),
    [rotateAnim]
  );

  return (
    <Animated.View
      style={{ transform: [{ rotate }] }}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      accessibilityLiveRegion="polite"
    >
      <Icon name="circular_progress" size={size} color={color} />
    </Animated.View>
  );
};
