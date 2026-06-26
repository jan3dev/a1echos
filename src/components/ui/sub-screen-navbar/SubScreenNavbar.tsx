import { RefObject, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getShadow, useTheme } from "@/theme";
import { iosPressed } from "@/utils";

import { AnimatedGlassSurface } from "../animated-glass-surface/AnimatedGlassSurface";
import { Icon } from "../icon/Icon";
import type { IconName } from "../icon/iconMap";
import { Text } from "../text/Text";

export const SUB_SCREEN_NAVBAR_HEIGHT = 72;

// The translucent glass bar sits over now-opaque scroll content, so any
// sub-pixel seam at the screen's bottom edge lets that content show as a
// hairline. Extending the bar this far below the edge (clipped off-screen by
// `overflow: hidden`) closes the seam.
const BOTTOM_BLEED = 1;

export interface SubScreenNavbarAction {
  key: string;
  icon: IconName;
  label: string;
  color?: string;
  disabled?: boolean;
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
}

export interface SubScreenNavbarProps {
  visible: boolean;
  actions: SubScreenNavbarAction[];
  testID?: string;
  /**
   * Android only: ref to the screen's `AppBarBlurTarget` wrapping the scroll
   * content that should show through the navbar's glass background.
   */
  blurTarget?: RefObject<View | null>;
  /**
   * When false (default) the bar is a solid `surfaceBackground`; when true its
   * glass/blur background fades in. Drive from whether the scroll content
   * overflows behind the bar.
   */
  scrolled?: boolean;
  style?: StyleProp<ViewStyle>;
}

interface NavbarActionProps {
  action: SubScreenNavbarAction;
  defaultColor: string;
  rippleColor: string;
}

const NavbarAction = ({
  action,
  defaultColor,
  rippleColor,
}: NavbarActionProps) => {
  const color = action.color ?? defaultColor;
  const disabled = action.disabled ?? false;
  return (
    <Pressable
      testID={action.testID}
      onPress={disabled ? undefined : action.onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel ?? action.label}
      accessibilityState={{ disabled }}
      hitSlop={8}
      android_ripple={
        disabled ? undefined : { color: rippleColor, borderless: true }
      }
      style={({ pressed }) => [
        styles.action,
        { opacity: disabled ? 0.5 : iosPressed(pressed) },
      ]}
    >
      <Icon name={action.icon} size={24} color={color} />
      <Text variant="caption2" weight="semibold" color={color} align="center">
        {action.label}
      </Text>
    </Pressable>
  );
};

export const SubScreenNavbar = ({
  visible,
  actions,
  testID,
  blurTarget,
  scrolled = false,
  style,
}: SubScreenNavbarProps) => {
  const { theme } = useTheme();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const totalHeight = SUB_SCREEN_NAVBAR_HEIGHT + bottomInset;
  const slideAnim = useRef(
    new Animated.Value(visible ? 0 : totalHeight),
  ).current;
  const [mounted, setMounted] = useState(visible);
  // Ref so the hide animation reads the latest height without listing
  // totalHeight as an effect dep — including it caused the spring to re-fire
  // when safe-area insets recalculated (e.g. when a modal mounted over the
  // screen), producing a visible jiggle.
  const totalHeightRef = useRef(totalHeight);
  totalHeightRef.current = totalHeight;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: totalHeightRef.current,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, slideAnim]);

  if (!mounted) return null;

  return (
    <Animated.View
      testID={testID}
      pointerEvents={visible ? "auto" : "none"}
      style={[
        styles.container,
        getShadow("modal"),
        {
          borderTopColor: theme.colors.surfaceBorderSecondary,
          // Extra `BOTTOM_BLEED` keeps the action row the same distance from the
          // screen edge while the container bleeds 1px below it (see styles).
          paddingBottom: bottomInset + BOTTOM_BLEED,
          transform: [{ translateY: slideAnim }],
        },
        style,
      ]}
    >
      <AnimatedGlassSurface scrolled={scrolled} blurTarget={blurTarget} />
      <View style={styles.row}>
        {actions.map((action) => (
          <NavbarAction
            key={action.key}
            action={action}
            defaultColor={theme.colors.textPrimary}
            rippleColor={theme.colors.ripple}
          />
        ))}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -BOTTOM_BLEED,
    overflow: "hidden",
  },
  row: {
    height: SUB_SCREEN_NAVBAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 16,
  },
  action: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
  },
});
