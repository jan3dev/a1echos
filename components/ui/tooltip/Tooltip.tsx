import { BlurView } from 'expo-blur';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../../theme';
import { Icon } from '../icon';
import { Text } from '../text';

export type TooltipVariant = 'normal' | 'success' | 'warning' | 'error';
export type TooltipPointerPosition = 'none' | 'top' | 'bottom';

export interface TooltipProps {
  visible: boolean;
  message: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
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

export const Tooltip = ({
  visible,
  message,
  leadingIcon,
  trailingIcon,
  onLeadingIconTap,
  onTrailingIconTap,
  isDismissible = false,
  isInfo = false,
  variant = 'normal',
  pointerPosition = 'none',
  pointerSize = DEFAULT_POINTER_SIZE,
  margin = 16,
  onDismiss,
}: TooltipProps) => {
  const { theme, isDark } = useTheme();
  const colors = theme.colors;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, fadeAnim]);

  const getBackgroundColor = () => {
    switch (variant) {
      case 'success':
        return colors.accentSuccessTransparent;
      case 'warning':
        return colors.accentWarningTransparent;
      case 'error':
        return colors.accentDangerTransparent;
      default:
        return colors.glassInverse;
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'success':
        return colors.accentSuccess;
      case 'warning':
        return colors.accentWarning;
      case 'error':
        return colors.accentDanger;
      default:
        return colors.textInverse;
    }
  };

  const getIconColor = () => {
    switch (variant) {
      case 'success':
        return colors.accentSuccess;
      case 'warning':
        return colors.accentWarning;
      case 'error':
        return colors.accentDanger;
      default:
        return colors.textInverse;
    }
  };

  const contentPadding = {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 8,
  };

  const renderPointer = () => {
    if (pointerPosition === 'none') return null;

    const pointerColor = getBackgroundColor();
    const isTop = pointerPosition === 'top';

    return (
      <View style={[styles.pointerContainer]}>
        <Svg
          width={pointerSize * 2}
          height={pointerSize}
          viewBox={`0 0 ${pointerSize * 2} ${pointerSize}`}
        >
          <Path
            d={
              isTop
                ? `M 0 ${pointerSize} L ${pointerSize} 0 L ${
                    pointerSize * 2
                  } ${pointerSize} Z`
                : `M 0 0 L ${pointerSize} ${pointerSize} L ${
                    pointerSize * 2
                  } 0 Z`
            }
            fill={pointerColor}
          />
        </Svg>
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
            variant === 'normal' ? getBackgroundColor() : 'transparent',
        },
      ]}
    >
      {isInfo && (
        <>
          {onLeadingIconTap ? (
            <Pressable onPress={onLeadingIconTap} hitSlop={8}>
              {leadingIcon || (
                <Icon name="warning" size={18} color={getIconColor()} />
              )}
            </Pressable>
          ) : (
            leadingIcon || (
              <Icon name="warning" size={18} color={getIconColor()} />
            )
          )}
          <View style={styles.iconSpacing} />
        </>
      )}
      <Text
        variant="body2"
        weight="medium"
        color={getTextColor()}
        style={styles.messageText}
      >
        {message}
      </Text>
      {isDismissible && (
        <>
          <View style={styles.trailingSpacing} />
          <Pressable onPress={onTrailingIconTap || onDismiss} hitSlop={8}>
            {trailingIcon || (
              <Icon
                name="close"
                size={18}
                color={
                  variant === 'normal' ? colors.textTertiary : getIconColor()
                }
              />
            )}
          </Pressable>
        </>
      )}
    </View>
  );

  const bubble =
    variant === 'normal' ? (
      <BlurView
        intensity={20}
        tint={isDark ? 'light' : 'dark'}
        style={{ borderRadius: DEFAULT_BORDER_RADIUS, overflow: 'hidden' }}
      >
        {renderContent()}
      </BlurView>
    ) : (
      <View
        style={{
          borderRadius: DEFAULT_BORDER_RADIUS,
          backgroundColor: getBackgroundColor(),
        }}
      >
        {renderContent()}
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
      pointerEvents={isDismissible ? 'auto' : 'none'}
    >
      <View style={styles.contentWrapper}>
        {pointerPosition === 'top' && renderPointer()}
        {bubble}
        {pointerPosition === 'bottom' && renderPointer()}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    maxWidth: '90%',
  },
  contentWrapper: {
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 34,
  },
  iconSpacing: {
    width: 8,
  },
  messageText: {
    flex: 1,
  },
  trailingSpacing: {
    width: 16,
  },
  pointerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
