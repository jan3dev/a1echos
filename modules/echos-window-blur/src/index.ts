import { requireNativeView } from "expo";
import { ComponentType } from "react";
import { Platform, ViewProps } from "react-native";

export interface WindowBlurViewProps extends ViewProps {
  /** Blur-behind radius in dp. */
  radius: number;
}

/**
 * Android 12+: blurs everything behind the window this view sits in (meant for
 * RN Modals). Renders nothing elsewhere.
 */
export const WindowBlurView: ComponentType<WindowBlurViewProps> | null =
  Platform.OS === "android" ? requireNativeView("EchosWindowBlur") : null;
