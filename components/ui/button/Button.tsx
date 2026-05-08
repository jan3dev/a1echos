import { LinearGradient } from "expo-linear-gradient";
import { ReactNode, useState } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

import {
  AquaPrimitiveColors,
  AquaTypography,
  getShadow,
  useTheme,
} from "@/theme";
import { iosPressed } from "@/utils";

import { ProgressIndicator } from "../progress/ProgressIndicator";
import { RipplePressable } from "../ripple-pressable/RipplePressable";

export type UtilityButtonSize = "large" | "small";

type ButtonType = "primary" | "secondary" | "tertiary" | "utility";

type ButtonState =
  | "default"
  | "hover"
  | "active"
  | "focus"
  | "disabled"
  | "loading";

export interface ButtonProps {
  text: string;
  onPress?: () => void;
  icon?: ReactNode;
  isLoading?: boolean;
  enabled?: boolean;
  testID?: string;
}

interface UtilityButtonProps extends ButtonProps {
  size?: UtilityButtonSize;
}

const PRIMARY_BUTTON_HEIGHT = 56;
const UTILITY_HEIGHT_LARGE = 34;
const UTILITY_HEIGHT_SMALL = 28;
const PILL_BORDER_RADIUS = 80;
const UTILITY_BORDER_RADIUS = 8;
const FOCUS_RING_OFFSET = 3;
const FOCUS_RING_WIDTH = 2;

const ButtonBase = ({
  text,
  onPress,
  icon,
  isLoading,
  enabled = true,
  testID,
  size = "large",
  type,
}: ButtonProps & {
  size?: UtilityButtonSize;
  type: ButtonType;
}) => {
  const { theme } = useTheme();
  const colors = theme.colors;

  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const isUtility = type === "utility";
  const borderRadius = isUtility ? UTILITY_BORDER_RADIUS : PILL_BORDER_RADIUS;
  const height = isUtility
    ? size === "small"
      ? UTILITY_HEIGHT_SMALL
      : UTILITY_HEIGHT_LARGE
    : PRIMARY_BUTTON_HEIGHT;
  const textStyle = isUtility
    ? AquaTypography.body2SemiBold
    : AquaTypography.body1SemiBold;
  const horizontalPadding = isUtility ? 14 : 32;

  const state = deriveState({ enabled, isLoading, pressed, focused, hovered });
  const interactive = enabled && !isLoading;

  const backgroundColor = getBackgroundColor(type, state, colors);
  const textColor =
    type === "secondary" || type === "tertiary"
      ? colors.textSecondary
      : AquaPrimitiveColors.white;

  const showsPrimaryGradient =
    type === "primary" && state !== "active" && state !== "hover";

  const opacity = !enabled
    ? 0.5
    : type === "primary" && (state === "active" || state === "hover")
      ? 1
      : iosPressed(pressed, 0.9);

  const shadowStyle: ViewStyle | undefined =
    type === "utility" ? getShadow("button") : undefined;

  const showFocusRing = state === "focus";

  return (
    <View style={[shadowStyle, styles.outerWrap]}>
      <RipplePressable
        testID={testID}
        onPress={interactive ? onPress : undefined}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={!interactive}
        accessibilityRole="button"
        accessibilityLabel={text}
        accessibilityState={{ disabled: !enabled, busy: isLoading }}
        rippleColor={
          type === "primary" || type === "utility"
            ? colors.rippleOnPrimary
            : colors.ripple
        }
        style={[
          styles.button,
          {
            height,
            backgroundColor,
            opacity,
            paddingHorizontal: horizontalPadding,
            borderRadius,
          },
        ]}
      >
        {showsPrimaryGradient && (
          <>
            <LinearGradient
              colors={[
                AquaPrimitiveColors.neonBlue400,
                AquaPrimitiveColors.neonBlue500,
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius }]}
              pointerEvents="none"
            />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                styles.primaryInsetHighlight,
                { borderRadius },
              ]}
            />
          </>
        )}
        <View style={styles.content}>
          {isLoading ? (
            <View
              style={[
                styles.loadingContainer,
                isUtility && styles.utilityPadding,
              ]}
            >
              <ProgressIndicator color={textColor} size={24} />
            </View>
          ) : (
            <>
              {icon && (
                <>
                  {isUtility && <View style={styles.utilityIconSpacing} />}
                  {icon}
                  <View style={styles.iconSpacing} />
                </>
              )}
              <Text
                style={[
                  textStyle,
                  { color: textColor },
                  isUtility && styles.utilityTextPadding,
                ]}
              >
                {text}
              </Text>
            </>
          )}
        </View>
      </RipplePressable>
      {showFocusRing && (
        <View
          testID={testID ? `${testID}-focus-ring` : undefined}
          pointerEvents="none"
          style={[
            styles.focusRing,
            {
              borderRadius: borderRadius + FOCUS_RING_OFFSET,
              borderColor: colors.buttonFocusRing,
            },
          ]}
        />
      )}
    </View>
  );
};

const deriveState = ({
  enabled,
  isLoading,
  pressed,
  focused,
  hovered,
}: {
  enabled: boolean;
  isLoading: boolean | undefined;
  pressed: boolean;
  focused: boolean;
  hovered: boolean;
}): ButtonState => {
  if (!enabled) return "disabled";
  if (isLoading) return "loading";
  if (pressed) return "active";
  if (focused) return "focus";
  if (hovered) return "hover";
  return "default";
};

const getBackgroundColor = (
  type: ButtonType,
  state: ButtonState,
  colors: ReturnType<typeof useTheme>["theme"]["colors"],
): string => {
  if (type === "primary") {
    if (state === "active" || state === "hover")
      return colors.buttonPrimaryBackgroundFlat;
    return "transparent";
  }
  if (type === "secondary") return colors.surfaceSecondary;
  if (type === "tertiary") {
    if (state === "focus") return colors.surfacePrimary;
    if (state === "active" || state === "hover") return colors.surfaceTertiary;
    return "transparent";
  }
  return colors.buttonUtilityBackground;
};

export const Button = {
  primary: (props: ButtonProps) => <ButtonBase {...props} type="primary" />,
  secondary: (props: ButtonProps) => <ButtonBase {...props} type="secondary" />,
  tertiary: (props: ButtonProps) => <ButtonBase {...props} type="tertiary" />,
  utility: (props: UtilityButtonProps) => (
    <ButtonBase {...props} type="utility" />
  ),
};

const styles = StyleSheet.create({
  outerWrap: {
    alignSelf: "stretch",
  },
  button: {
    alignSelf: "stretch",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 120,
  },
  loadingContainer: {
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  utilityPadding: {
    paddingHorizontal: 2,
  },
  iconSpacing: {
    width: 8,
  },
  utilityIconSpacing: {
    width: 4,
  },
  utilityTextPadding: {
    paddingHorizontal: 2,
  },
  primaryInsetHighlight: {
    borderTopWidth: 2,
    borderTopColor: AquaPrimitiveColors.neonBlue300,
  },
  focusRing: {
    position: "absolute",
    top: -FOCUS_RING_OFFSET,
    left: -FOCUS_RING_OFFSET,
    right: -FOCUS_RING_OFFSET,
    bottom: -FOCUS_RING_OFFSET,
    borderWidth: FOCUS_RING_WIDTH,
  },
});
