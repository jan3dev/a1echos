import React, { useEffect, useRef } from 'react';
import {
  AccessibilityProps,
  Animated,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../theme';
import { AquaPrimitiveColors } from '../../theme/colors';

interface ToggleProps {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  activeColor?: string;
  trackColor?: string;
  thumbColor?: string;
  enabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const Toggle = ({
  value,
  onValueChange,
  activeColor,
  trackColor,
  thumbColor,
  enabled = true,
  accessibilityLabel,
  accessibilityHint,
}: ToggleProps & AccessibilityProps) => {
  const { theme } = useTheme();
  const colors = theme.colors;
  const animation = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animation, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [value, animation]);

  const handlePress = () => {
    if (enabled && onValueChange) {
      onValueChange(!value);
    }
  };

  const activeColorValue = activeColor || colors.accentBrand;
  const trackColorValue = trackColor || colors.surfaceBorderSecondary;
  const thumbColorValue = thumbColor || colors.textInverse;

  const backgroundColor = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [trackColorValue, activeColorValue],
  });

  const thumbPosition = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 18],
  });

  const shadowOffsetY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2],
  });

  return (
    <Pressable
      onPress={handlePress}
      disabled={!enabled}
      style={{ opacity: enabled ? 1 : 0.5 }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !enabled }}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      <Animated.View style={[styles.track, { backgroundColor }]}>
        <Animated.View
          style={[
            styles.thumb,
            {
              left: thumbPosition,
              backgroundColor: thumbColorValue,
              shadowColor: AquaPrimitiveColors.shadow,
              shadowOffset: {
                width: 0,
                height: shadowOffsetY,
              },
              shadowOpacity: 1,
              shadowRadius: 4,
              elevation: 4,
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  track: {
    width: 40,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});
