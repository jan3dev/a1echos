import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { GlassIconButton } from "@/components/ui/glass-icon-button/GlassIconButton";
import { Icon } from "@/components/ui/icon";
import { useTheme } from "@/theme";

export type ScrollToEdgeDirection = "up" | "down";

export interface ScrollToEdgeButtonProps {
  visible: boolean;
  direction: ScrollToEdgeDirection;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
}

const ANIMATION_DURATION_MS = 180;
const HIDDEN_SCALE = 0.8;

export const ScrollToEdgeButton = ({
  visible,
  direction,
  onPress,
  accessibilityLabel,
  testID,
}: ScrollToEdgeButtonProps) => {
  const { theme } = useTheme();

  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: ANIMATION_DURATION_MS,
    });
  }, [visible, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: HIDDEN_SCALE + (1 - HIDDEN_SCALE) * progress.value }],
  }));

  // No chevron_up icon exists; rotate chevron_left.
  const iconRotation = direction === "down" ? "-90deg" : "90deg";

  return (
    <Animated.View
      style={[
        animatedStyle,
        styles.border,
        { borderColor: theme.colors.surfaceBorderPrimary },
      ]}
      pointerEvents={visible ? "auto" : "none"}
      testID={testID}
    >
      <GlassIconButton
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
      >
        <Icon
          name="chevron_left"
          size={24}
          color={theme.colors.textPrimary}
          style={{ transform: [{ rotate: iconRotation }] }}
        />
      </GlassIconButton>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  border: {
    borderWidth: 1,
    borderRadius: 20,
  },
});
