import { LinearGradient } from "expo-linear-gradient";
import { ReactNode } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

import {
  AquaPrimitiveColors,
  AquaTypography,
  getShadow,
  lightColors,
  useTheme,
} from "@/theme";
import { iosPressed } from "@/utils";

import { ProgressIndicator } from "../progress/ProgressIndicator";
import { RipplePressable } from "../ripple-pressable/RipplePressable";

export type ButtonSize = "large" | "small";
export type ButtonVariant = "normal" | "error" | "success" | "warning";

type ButtonType =
  | "primary"
  | "secondary"
  | "tertiary"
  | "utility"
  | "utilitySecondary";

interface BaseButtonProps {
  text: string;
  onPress?: () => void;
  icon?: ReactNode;
  isLoading?: boolean;
  enabled?: boolean;
  testID?: string;
}

interface PrimarySecondaryButtonProps extends BaseButtonProps {
  size?: ButtonSize;
  variant?: ButtonVariant;
}

interface TertiaryButtonProps extends BaseButtonProps {
  size?: ButtonSize;
}

type UtilityButtonProps = BaseButtonProps;

const BUTTON_HEIGHT_LARGE = 56;
const BUTTON_HEIGHT_SMALL = 34;
const PILL_BORDER_RADIUS = 80;
const UTILITY_BORDER_RADIUS = 8;

const ButtonBase = ({
  text,
  onPress,
  icon,
  isLoading,
  enabled = true,
  testID,
  size = "large",
  variant = "normal",
  type,
}: BaseButtonProps & {
  size?: ButtonSize;
  variant?: ButtonVariant;
  type: ButtonType;
}) => {
  const { theme } = useTheme();
  const colors = theme.colors;

  const isSmall =
    size === "small" || type === "utility" || type === "utilitySecondary";
  const height = isSmall ? BUTTON_HEIGHT_SMALL : BUTTON_HEIGHT_LARGE;
  const isUtility = type === "utility" || type === "utilitySecondary";
  const isPill = !isUtility;
  const borderRadius = isPill ? PILL_BORDER_RADIUS : UTILITY_BORDER_RADIUS;

  const getVariantColor = () =>
    ({
      error: colors.accentDanger,
      success: colors.accentSuccess,
      warning: colors.accentWarning,
      normal: colors.accentBrand,
    })[variant];

  const showsPrimaryGradient = type === "primary" && variant === "normal";

  const getBackgroundColor = (pressed: boolean) => {
    if (!enabled) {
      if (type === "primary") {
        // Disabled primary: handled via opacity for the gradient case;
        // for non-normal variants we show a translucent flat fill.
        return showsPrimaryGradient ? "transparent" : `${getVariantColor()}80`;
      }
      if (type === "secondary") {
        return colors.surfaceSecondary;
      }
      if (type === "utility") {
        return `${colors.surfacePrimary}80`;
      }
      if (type === "utilitySecondary") {
        return `${colors.surfaceTertiary}80`;
      }
      return "transparent";
    }

    if (type === "primary") {
      return showsPrimaryGradient ? "transparent" : getVariantColor();
    }

    if (type === "secondary") {
      return colors.surfaceSecondary;
    }

    if (type === "tertiary") {
      return pressed ? `${colors.surfaceTertiary}80` : "transparent";
    }

    if (type === "utility") {
      return colors.surfacePrimary;
    }

    if (type === "utilitySecondary") {
      return colors.surfaceTertiary;
    }

    return "transparent";
  };

  const getTextColor = () => {
    if (type === "primary") {
      return lightColors.textInverse;
    }
    if (type === "secondary") {
      return variant === "normal" ? colors.textSecondary : getVariantColor();
    }
    if (type === "tertiary") {
      return colors.textSecondary;
    }
    return colors.textPrimary;
  };

  const getSpinnerColor = () => {
    if (type === "primary") {
      return lightColors.textInverse;
    }
    if (type === "secondary") {
      return variant === "normal" ? colors.textSecondary : getVariantColor();
    }
    if (type === "tertiary") {
      return colors.textSecondary;
    }
    return colors.textPrimary;
  };

  const textStyle = isSmall
    ? AquaTypography.body2SemiBold
    : AquaTypography.body1SemiBold;

  const horizontalPadding = isUtility ? 14 : 32;

  const shadowStyle: ViewStyle | undefined =
    type === "utility" ? getShadow("button") : undefined;

  const buttonContent = (
    <RipplePressable
      testID={testID}
      onPress={enabled ? onPress : undefined}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ disabled: !enabled }}
      rippleColor={type === "primary" ? colors.rippleOnPrimary : colors.ripple}
      style={({ pressed }) => [
        styles.button,
        {
          height,
          backgroundColor: getBackgroundColor(pressed),
          opacity: enabled ? iosPressed(pressed, 0.9) : 0.5,
          paddingHorizontal: isSmall ? horizontalPadding : 0,
          borderRadius,
        },
      ]}
    >
      {showsPrimaryGradient && (
        <LinearGradient
          colors={[
            AquaPrimitiveColors.neonBlue400,
            AquaPrimitiveColors.neonBlue500,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
      )}
      {showsPrimaryGradient && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.primaryInsetHighlight,
            { borderRadius },
          ]}
        />
      )}
      <View style={styles.content}>
        {isLoading ? (
          <View
            style={[
              styles.loadingContainer,
              isUtility && styles.utilityPadding,
            ]}
          >
            <ProgressIndicator color={getSpinnerColor()} size={24} />
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
                { color: getTextColor() },
                isUtility && styles.utilityTextPadding,
              ]}
            >
              {text}
            </Text>
          </>
        )}
      </View>
    </RipplePressable>
  );

  if (shadowStyle) {
    return (
      <View
        style={[
          shadowStyle,
          {
            borderRadius,
            alignSelf: "stretch",
          },
        ]}
      >
        {buttonContent}
      </View>
    );
  }

  return buttonContent;
};

export const Button = {
  primary: (props: PrimarySecondaryButtonProps) => (
    <ButtonBase {...props} type="primary" />
  ),
  secondary: (props: PrimarySecondaryButtonProps) => (
    <ButtonBase {...props} type="secondary" />
  ),
  tertiary: (props: TertiaryButtonProps) => (
    <ButtonBase {...props} type="tertiary" variant="normal" />
  ),
  utility: (props: UtilityButtonProps) => (
    <ButtonBase {...props} type="utility" size="small" variant="normal" />
  ),
  utilitySecondary: (props: UtilityButtonProps) => (
    <ButtonBase
      {...props}
      type="utilitySecondary"
      size="small"
      variant="normal"
    />
  ),
};

const styles = StyleSheet.create({
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
    borderTopColor: "#7A92F3",
  },
});
