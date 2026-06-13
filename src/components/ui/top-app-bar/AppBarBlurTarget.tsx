import { BlurTargetView } from "expo-blur";
import { RefObject } from "react";
import { Platform, View, ViewProps } from "react-native";

export interface AppBarBlurTargetProps extends ViewProps {
  /**
   * Ref handed to a bar's `blurTarget` (TopAppBar / SubScreenNavbar). Populated
   * and used only on Android; on other platforms the forwarded ref goes unused.
   */
  targetRef?: RefObject<View | null>;
}

/**
 * Wraps the scrollable content that a blurred bar should sample.
 *
 * On Android, expo-blur cannot blur arbitrary views sitting behind it — the
 * `BlurView` must be given an explicit `BlurTargetView` whose ref it samples
 * (see the bars' `blurTarget` prop). On iOS the system blur blurs the
 * underlying content natively, so this collapses to a plain passthrough `View`
 * and the layout is identical to having no wrapper.
 */
export const AppBarBlurTarget = ({
  targetRef,
  ...props
}: AppBarBlurTargetProps) => {
  if (Platform.OS === "android") {
    return <BlurTargetView ref={targetRef} {...props} />;
  }
  return <View ref={targetRef} {...props} />;
};
