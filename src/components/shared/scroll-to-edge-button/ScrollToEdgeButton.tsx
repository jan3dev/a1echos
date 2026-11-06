import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Icon } from "@/components/ui/icon";
import { RipplePressable } from "@/components/ui/ripple-pressable/RipplePressable";
import { useTheme } from "@/theme";
import { iosPressed } from "@/utils";

export type ScrollToEdgeDirection = "up" | "down";

export interface ScrollToEdgeButtonProps {
  visible: boolean;
  direction: ScrollToEdgeDirection;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
}

export const SCROLL_TO_EDGE_BUTTON_SIZE = 40;

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
      style={animatedStyle}
      pointerEvents={visible ? "auto" : "none"}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
      testID={testID}
    >
      <RipplePressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={6}
        borderless
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: theme.colors.surfaceSecondary,
            borderColor: theme.colors.surfaceBorderSecondary,
            opacity: iosPressed(pressed),
          },
        ]}
      >
        <Icon
          name="chevron_left"
          size={18}
          color={theme.colors.textSecondary}
          style={{ transform: [{ rotate: iconRotation }] }}
        />
      </RipplePressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    width: SCROLL_TO_EDGE_BUTTON_SIZE,
    height: SCROLL_TO_EDGE_BUTTON_SIZE,
    borderRadius: SCROLL_TO_EDGE_BUTTON_SIZE / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
