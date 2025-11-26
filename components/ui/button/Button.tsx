import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AquaTypography } from '../../../theme/typography';
import { useTheme } from '../../../theme/useTheme';
import { ProgressIndicator } from '../progress';

export type ButtonSize = 'large' | 'small';
export type ButtonVariant = 'normal' | 'error' | 'success' | 'warning';

type ButtonType =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'utility'
  | 'utilitySecondary';

interface BaseButtonProps {
  text: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  isLoading?: boolean;
  enabled?: boolean;
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
const BUTTON_BORDER_RADIUS = 8;

const ButtonBase = ({
  text,
  onPress,
  icon,
  isLoading,
  enabled = true,
  size = 'large',
  variant = 'normal',
  type,
}: BaseButtonProps & {
  size?: ButtonSize;
  variant?: ButtonVariant;
  type: ButtonType;
}) => {
  const { theme } = useTheme();
  const colors = theme.colors;

  const isSmall =
    size === 'small' || type === 'utility' || type === 'utilitySecondary';
  const height = isSmall ? BUTTON_HEIGHT_SMALL : BUTTON_HEIGHT_LARGE;
  const isUtility = type === 'utility' || type === 'utilitySecondary';

  const getBackgroundColor = (pressed: boolean) => {
    if (!enabled) {
      if (type === 'primary') {
        const variantColor = {
          error: colors.accentDanger,
          success: colors.accentSuccess,
          warning: colors.accentWarning,
          normal: colors.accentBrand,
        }[variant];
        return `${variantColor}80`;
      }
      if (type === 'secondary') {
        return variant === 'normal'
          ? `${colors.accentBrand}14`
          : variant === 'error'
          ? `${colors.accentDanger}14`
          : variant === 'success'
          ? `${colors.accentSuccess}14`
          : `${colors.accentWarning}14`;
      }
      if (type === 'utility') {
        return `${colors.surfacePrimary}80`;
      }
      if (type === 'utilitySecondary') {
        return `${colors.surfaceTertiary}80`;
      }
      return 'transparent';
    }

    if (type === 'primary') {
      return {
        error: colors.accentDanger,
        success: colors.accentSuccess,
        warning: colors.accentWarning,
        normal: colors.accentBrand,
      }[variant];
    }

    if (type === 'secondary') {
      return variant === 'normal'
        ? colors.accentBrandTransparent
        : variant === 'error'
        ? colors.accentDangerTransparent
        : variant === 'success'
        ? colors.accentSuccessTransparent
        : colors.accentWarningTransparent;
    }

    if (type === 'tertiary') {
      return pressed ? `${colors.surfaceTertiary}80` : 'transparent';
    }

    if (type === 'utility') {
      return colors.surfacePrimary;
    }

    if (type === 'utilitySecondary') {
      return colors.surfaceTertiary;
    }

    return 'transparent';
  };

  const getTextColor = () => {
    if (type === 'primary') {
      return colors.textInverse;
    }
    if (type === 'secondary') {
      return {
        error: colors.accentDanger,
        success: colors.accentSuccess,
        warning: colors.accentWarning,
        normal: colors.accentBrand,
      }[variant];
    }
    return colors.textPrimary;
  };

  const getSpinnerColor = () => {
    if (type === 'primary') {
      return colors.textInverse;
    }
    if (type === 'secondary') {
      return colors.accentBrand;
    }
    return colors.textPrimary;
  };

  const textStyle = isSmall
    ? AquaTypography.body2SemiBold
    : AquaTypography.body1SemiBold;

  const horizontalPadding = isUtility ? 14 : 24;

  return (
    <Pressable
      onPress={enabled ? onPress : undefined}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ disabled: !enabled }}
      style={({ pressed }) => [
        styles.button,
        {
          height,
          backgroundColor: getBackgroundColor(pressed),
          opacity: enabled ? (pressed ? 0.9 : 1) : 0.5,
          paddingHorizontal: isSmall ? horizontalPadding : 0,
          borderRadius: BUTTON_BORDER_RADIUS,
          ...(type === 'utility' && {
            shadowColor: '#00000042',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 1,
            shadowRadius: 8,
            elevation: 8,
          }),
        },
      ]}
    >
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
    </Pressable>
  );
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
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  loadingContainer: {
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
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
});
