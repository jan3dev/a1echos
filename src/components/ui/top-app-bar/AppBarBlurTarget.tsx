import { BlurTargetView } from "expo-blur";
import { RefObject } from "react";
import { Platform, View, ViewProps } from "react-native";

import { useTheme } from "@/theme";

export interface AppBarBlurTargetProps extends ViewProps {
  /**
   * Ref handed to a bar's `blurTarget` (TopAppBar). Populated and used only on
   * Android; on other platforms the forwarded ref goes unused.
   */
  targetRef?: RefObject<View | null>;
}

/**
 * Wraps the scrollable content that a blurred bar should sample.
 *
 * On Android, expo-blur cannot blur arbitrary views sitting behind it — the
 * `BlurView` must be given an explicit `BlurTargetView` whose own snapshot it
 * samples (see the bars' `blurTarget` prop). That snapshot must be opaque: the
 * screen's `surfaceBackground` lives on the `Screen` view *outside* this target,
 * so without painting it here the captured bitmap is transparent and the bar
 * shows only its flat tint with no blur. On iOS the system blur blurs the live
 * content behind the bar natively and ignores this, so painting the same
 * background is a harmless no-op there.
 */
export const AppBarBlurTarget = ({
  targetRef,
  style,
  ...props
}: AppBarBlurTargetProps) => {
  const { theme } = useTheme();
  const mergedStyle = [
    { backgroundColor: theme.colors.surfaceBackground },
    style,
  ];

  if (Platform.OS === "android") {
    return <BlurTargetView ref={targetRef} style={mergedStyle} {...props} />;
  }
  return <View ref={targetRef} style={mergedStyle} {...props} />;
};
