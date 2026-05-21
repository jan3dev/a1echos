import { useEffect, useRef } from "react";
import {
  AccessibilityProps,
  Animated,
  Platform,
  StyleSheet,
} from "react-native";

import { AquaPrimitiveColors, useTheme } from "@/theme";

import { RipplePressable } from "../ripple-pressable/RipplePressable";

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
  const thumbColorValue = thumbColor || AquaPrimitiveColors.white;

  const backgroundColor = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [trackColorValue, activeColorValue],
  });

  const thumbPosition = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 17],
  });

  const shadowOffsetY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2],
  });

  return (
    <RipplePressable
      onPress={handlePress}
      disabled={!enabled}
      style={{ opacity: enabled ? 1 : 0.5 }}
      rippleColor={colors.ripple}
      borderless
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !enabled }}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      <Animated.View
        style={[
          styles.track,
          {
            backgroundColor,
            borderColor: trackColor ?? colors.surfaceBorderPrimary,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              left: thumbPosition,
              backgroundColor: thumbColorValue,
              shadowColor: AquaPrimitiveColors.black,
              shadowOffset: {
                width: 0,
                height: Platform.OS === "android" ? 2 : shadowOffsetY,
              },
              shadowOpacity: 0.25,
              shadowRadius: 3,
              elevation: 3,
            },
          ]}
        />
      </Animated.View>
    </RipplePressable>
  );
};

const styles = StyleSheet.create({
  track: {
    width: 40,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
  },
  thumb: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});
