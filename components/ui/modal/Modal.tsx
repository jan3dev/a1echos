import { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { Button, ButtonVariant, Dimmer, Text } from '@/components';
import { getShadow, useTheme } from '@/theme';

export type ModalVariant = 'normal' | 'success' | 'danger' | 'warning' | 'info';

export interface ModalProps {
  visible: boolean;
  title: string;
  message: string;
  messageTertiary?: string;
  primaryButton: {
    text: string;
    onTap: () => void;
    variant?: ButtonVariant;
  };
  secondaryButton?: {
    text: string;
    onTap: () => void;
    variant?: ButtonVariant;
  };
  icon?: React.ReactNode;
  illustration?: React.ReactNode;
  iconVariant?: ModalVariant;
  titleMaxLines?: number;
  messageMaxLines?: number;
  onDismiss?: () => void;
}

export const Modal = ({
  visible,
  title,
  message,
  messageTertiary,
  primaryButton,
  secondaryButton,
  icon,
  illustration,
  iconVariant = 'normal',
  titleMaxLines = 3,
  messageMaxLines = 5,
  onDismiss,
}: ModalProps) => {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const colors = theme.colors;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const getIconBackgroundColor = () => {
    switch (iconVariant) {
      case 'success':
        return colors.accentSuccessTransparent;
      case 'danger':
        return colors.accentDangerTransparent;
      case 'warning':
        return colors.accentWarningTransparent;
      case 'info':
        return colors.accentBrandTransparent;
      default:
        return colors.surfaceTertiary;
    }
  };

  const getIconInnerBackgroundColor = () => {
    switch (iconVariant) {
      case 'success':
        return colors.accentSuccess;
      case 'danger':
        return colors.accentDanger;
      case 'warning':
        return colors.accentWarning;
      case 'info':
        return colors.accentBrand;
      default:
        return colors.surfaceSecondary;
    }
  };

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  const opacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const maxWidth = width >= 768 ? 343 : undefined;

  return (
    <Dimmer visible={visible} onDismiss={onDismiss || (() => {})}>
      <View style={styles.contentWrapper}>
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ translateY }],
              opacity,
              maxWidth,
            },
          ]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View
              style={[styles.card, { backgroundColor: colors.surfacePrimary }]}
            >
              {/* Drag handle */}
              <View
                style={[
                  styles.dragHandle,
                  { backgroundColor: colors.systemBackgroundColor },
                ]}
              />

              {/* Icon or Illustration */}
              {icon && (
                <View
                  style={[
                    styles.iconOuterContainer,
                    { backgroundColor: getIconBackgroundColor() },
                  ]}
                >
                  <View
                    style={[
                      styles.iconInnerContainer,
                      { backgroundColor: getIconInnerBackgroundColor() },
                    ]}
                  >
                    {icon}
                  </View>
                </View>
              )}

              {illustration && (
                <View style={styles.illustrationContainer}>{illustration}</View>
              )}

              {/* Title */}
              <Text
                variant="h4"
                weight="medium"
                size={24}
                color={colors.textPrimary}
                numberOfLines={titleMaxLines}
                align="center"
              >
                {title}
              </Text>

              {/* Message */}
              <View style={styles.messageSpacing} />
              <Text
                variant="body1"
                weight="regular"
                color={colors.textSecondary}
                numberOfLines={messageMaxLines}
                align="center"
                style={styles.messageText}
              >
                {message}
              </Text>

              {/* Tertiary Message */}
              {messageTertiary && (
                <>
                  <View style={styles.tertiarySpacing} />
                  <Text
                    variant="body1"
                    weight="semibold"
                    color={colors.accentDanger}
                    numberOfLines={5}
                    align="center"
                    style={styles.tertiaryText}
                  >
                    {messageTertiary}
                  </Text>
                </>
              )}

              <View style={styles.buttonsSpacing} />

              {/* Primary Button */}
              <Button.primary
                text={primaryButton.text}
                variant={primaryButton.variant || 'normal'}
                onPress={primaryButton.onTap}
              />

              {/* Secondary Button */}
              {secondaryButton && (
                <>
                  <View style={styles.secondaryButtonSpacing} />
                  <Button.secondary
                    text={secondaryButton.text}
                    variant={secondaryButton.variant || 'normal'}
                    onPress={secondaryButton.onTap}
                  />
                </>
              )}

              <View style={styles.bottomSpacing} />
            </View>
          </Pressable>
        </Animated.View>
      </View>
    </Dimmer>
  );
};

const styles = StyleSheet.create({
  contentWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  container: {
    marginBottom: 20,
    marginHorizontal: 16,
    ...getShadow('modal'),
  },
  card: {
    borderRadius: 24,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  dragHandle: {
    width: 48,
    height: 5,
    borderRadius: 100,
    marginTop: 8,
    alignSelf: 'center',
  },
  iconOuterContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignSelf: 'center',
    marginTop: 32,
    marginBottom: 24,
    padding: 16,
  },
  iconInnerContainer: {
    flex: 1,
    borderRadius: 28,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationContainer: {
    width: 88,
    height: 88,
    alignSelf: 'center',
    marginTop: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageSpacing: {
    height: 6,
  },
  messageText: {
    lineHeight: 19.2,
  },
  tertiarySpacing: {
    height: 32,
  },
  tertiaryText: {
    lineHeight: 16,
  },
  buttonsSpacing: {
    height: 32,
  },
  secondaryButtonSpacing: {
    height: 16,
  },
  bottomSpacing: {
    height: 32,
  },
});
