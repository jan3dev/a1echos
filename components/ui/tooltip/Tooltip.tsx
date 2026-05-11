import MaskedView from "@react-native-masked-view/masked-view";
import { BlurView } from "@sbaiahmed1/react-native-blur";
import { ReactNode, useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useTheme } from "@/theme";

import { Icon } from "../icon/Icon";
import { RipplePressable } from "../ripple-pressable/RipplePressable";
import { Text } from "../text/Text";

export type TooltipVariant = "normal" | "error";
export type TooltipPointerPosition = "none" | "bottom";

export interface TooltipProps {
  visible: boolean;
  message: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  onLeadingIconTap?: () => void;
  onTrailingIconTap?: () => void;
  isDismissible?: boolean;
  isInfo?: boolean;
  variant?: TooltipVariant;
  pointerPosition?: TooltipPointerPosition;
  pointerSize?: number;
  margin?: number;
  onDismiss?: () => void;
}

const DEFAULT_POINTER_SIZE = 8;
const DEFAULT_BORDER_RADIUS = 32;
export const TOOLTIP_FADE_DURATION_MS = 200;

export const Tooltip = ({
  visible,
  message,
  leadingIcon,
  trailingIcon,
  onLeadingIconTap,
  onTrailingIconTap,
  isDismissible = false,
  isInfo = false,
  variant = "normal",
  pointerPosition = "none",
  pointerSize = DEFAULT_POINTER_SIZE,
  margin = 16,
  onDismiss,
}: TooltipProps) => {
  const { theme, isDark } = useTheme();
  const colors = theme.colors;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: TOOLTIP_FADE_DURATION_MS,
      useNativeDriver: true,
    }).start();
  }, [visible, fadeAnim]);

  const normalBackground = isDark
    ? colors.glassSurfaceSecondary
    : colors.glassInverse;
  const normalForeground = isDark ? colors.textPrimary : colors.textInverse;

  const backgroundColor =
    variant === "error" ? colors.accentDangerTransparent : normalBackground;
  const foregroundColor =
    variant === "error" ? colors.accentDanger : normalForeground;

  const contentPadding = {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 8,
  };

  const leadingIconNode = leadingIcon || (
    <Icon name="info_circle" size={18} color={foregroundColor} />
  );

  const renderPointer = () => {
    if (pointerPosition === "none") return null;

    // Dark theme bubble bg is rgba(255,255,255,0.16) — too translucent for the
    // BlurView+MaskedView pointer to track the bubble's blur context, so the
    // pointer drifts lighter. Fall back to a solid color approximating the
    // bubble's perceived gray (16% white over a blurred dark surface).
    const useSolidFill = variant !== "normal" || isDark;
    const solidFill = variant === "normal" ? "#3A3D41" : backgroundColor;

    const triangleSvg = (
      <Svg
        width={pointerSize * 2}
        height={pointerSize}
        viewBox={`0 0 ${pointerSize * 2} ${pointerSize}`}
      >
        <Path
          d={`M 0 0 L ${pointerSize} ${pointerSize} L ${pointerSize * 2} 0 Z`}
          fill={useSolidFill ? solidFill : "white"}
        />
      </Svg>
    );

    if (useSolidFill) {
      return <View style={styles.pointerContainer}>{triangleSvg}</View>;
    }

    return (
      <View style={styles.pointerContainer}>
        <MaskedView
          style={{ width: pointerSize * 2, height: pointerSize }}
          maskElement={triangleSvg}
        >
          <BlurView
            blurAmount={20}
            blurRounds={3}
            blurType={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          >
            <View style={[StyleSheet.absoluteFill, { backgroundColor }]} />
          </BlurView>
        </MaskedView>
      </View>
    );
  };

  const renderContent = () => (
    <View
      style={[
        styles.content,
        contentPadding,
        {
          backgroundColor:
            variant === "normal" ? backgroundColor : "transparent",
        },
      ]}
    >
      {isInfo && (
        <>
          {onLeadingIconTap ? (
            <RipplePressable
              onPress={onLeadingIconTap}
              hitSlop={10}
              rippleColor={colors.ripple}
              borderless
            >
              {leadingIconNode}
            </RipplePressable>
          ) : (
            leadingIconNode
          )}
          <View style={styles.iconSpacing} />
        </>
      )}
      <Text
        variant="body2"
        weight="medium"
        color={foregroundColor}
        style={styles.messageText}
        numberOfLines={0}
      >
        {message}
      </Text>
      {isDismissible && (
        <>
          <View style={styles.trailingSpacing} />
          <RipplePressable
            onPress={onTrailingIconTap || onDismiss}
            hitSlop={10}
            rippleColor={colors.ripple}
            borderless
          >
            {trailingIcon || (
              <Icon name="close" size={18} color={foregroundColor} />
            )}
          </RipplePressable>
        </>
      )}
    </View>
  );

  const content = renderContent();
  const bubble =
    variant === "normal" ? (
      <BlurView
        blurAmount={20}
        blurRounds={3}
        blurType={isDark ? "dark" : "light"}
        style={{ borderRadius: DEFAULT_BORDER_RADIUS, overflow: "hidden" }}
      >
        {content}
      </BlurView>
    ) : (
      <View style={{ borderRadius: DEFAULT_BORDER_RADIUS, backgroundColor }}>
        {content}
      </View>
    );

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          margin,
        },
      ]}
      pointerEvents={isDismissible ? "auto" : "none"}
    >
      <View style={styles.contentWrapper}>
        {bubble}
        {pointerPosition === "bottom" && renderPointer()}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    maxWidth: "90%",
  },
  contentWrapper: {
    alignItems: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 34,
  },
  iconSpacing: {
    width: 8,
  },
  messageText: {
    flexShrink: 1,
  },
  trailingSpacing: {
    width: 16,
  },
  pointerContainer: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
});
