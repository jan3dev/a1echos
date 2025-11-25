import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTheme } from '../../theme';
import { Icon } from '../icon';
import { Text } from '../text';

export type ToastVariant = 'informative' | 'warning' | 'danger';

export interface ToastProps {
  visible: boolean;
  title: string;
  message: string;
  primaryButtonText?: string;
  onPrimaryButtonTap?: () => void;
  secondaryButtonText?: string;
  onSecondaryButtonTap?: () => void;
  variant?: ToastVariant;
  titleMaxLines?: number;
  messageMaxLines?: number;
  onDismiss: () => void;
}

export const Toast = ({
  visible,
  title,
  message,
  primaryButtonText,
  onPrimaryButtonTap,
  secondaryButtonText,
  onSecondaryButtonTap,
  variant = 'informative',
  titleMaxLines = 1,
  messageMaxLines = 2,
  onDismiss,
}: ToastProps) => {
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

  const getIconName = () => {
    switch (variant) {
      case 'danger':
        return 'danger' as const;
      case 'warning':
        return 'warning' as const;
      default:
        return 'warning' as const;
    }
  };

  const getIconColor = () => {
    switch (variant) {
      case 'danger':
        return colors.accentDanger;
      case 'warning':
        return colors.accentWarning;
      default:
        return colors.textPrimary;
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

  const hasButtons = primaryButtonText !== undefined;
  const maxWidth = width >= 768 ? 343 : undefined;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.modalOverlay} onPress={onDismiss}>
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
          <Pressable>
            <View
              style={[styles.card, { backgroundColor: colors.glassSurface }]}
            >
              {/* Main content */}
              <View
                style={[
                  styles.contentContainer,
                  {
                    backgroundColor: colors.surfacePrimary,
                    borderTopLeftRadius: 8,
                    borderTopRightRadius: 8,
                    borderBottomLeftRadius: hasButtons ? 0 : 8,
                    borderBottomRightRadius: hasButtons ? 0 : 8,
                  },
                ]}
              >
                <View style={styles.row}>
                  <Icon name={getIconName()} size={18} color={getIconColor()} />
                  <View style={styles.textColumn}>
                    <Text
                      variant="body1"
                      weight="semibold"
                      color={colors.textPrimary}
                      numberOfLines={titleMaxLines}
                    >
                      {title}
                    </Text>
                    <View style={styles.messageSpacing} />
                    <Text
                      variant="body2"
                      weight="medium"
                      color={`${colors.textPrimary}CC`}
                      numberOfLines={messageMaxLines}
                    >
                      {message}
                    </Text>
                  </View>
                  <Pressable onPress={onDismiss} hitSlop={8}>
                    <Icon
                      name="close"
                      size={18}
                      color={`${colors.textPrimary}80`}
                    />
                  </Pressable>
                </View>
              </View>

              {/* Buttons section */}
              {hasButtons && (
                <View
                  style={[
                    styles.buttonsContainer,
                    { backgroundColor: colors.glassSurface },
                  ]}
                >
                  {secondaryButtonText && primaryButtonText ? (
                    <View style={styles.twoButtonRow}>
                      <Pressable
                        style={[
                          styles.button,
                          styles.leftButton,
                          { backgroundColor: colors.surfacePrimary },
                        ]}
                        onPress={onSecondaryButtonTap}
                      >
                        <Text
                          variant="body2"
                          weight="semibold"
                          color={colors.textSecondary}
                        >
                          {secondaryButtonText}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.button,
                          styles.rightButton,
                          { backgroundColor: colors.surfacePrimary },
                        ]}
                        onPress={onPrimaryButtonTap}
                      >
                        <Text
                          variant="body2"
                          weight="semibold"
                          color={colors.textPrimary}
                        >
                          {primaryButtonText}
                        </Text>
                      </Pressable>
                    </View>
                  ) : primaryButtonText ? (
                    <Pressable
                      style={[
                        styles.button,
                        styles.singleButton,
                        { backgroundColor: colors.surfacePrimary },
                      ]}
                      onPress={onPrimaryButtonTap}
                    >
                      <Text
                        variant="body2"
                        weight="semibold"
                        color={colors.textPrimary}
                      >
                        {primaryButtonText}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    width: '100%',
    marginBottom: 20,
    marginHorizontal: 16,
  },
  card: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  contentContainer: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  textColumn: {
    flex: 1,
    marginLeft: 16,
  },
  messageSpacing: {
    height: 4,
  },
  buttonsContainer: {
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    overflow: 'hidden',
    paddingTop: 1,
  },
  twoButtonRow: {
    flexDirection: 'row',
    gap: 1,
  },
  button: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftButton: {
    flex: 1,
    borderBottomLeftRadius: 8,
  },
  rightButton: {
    flex: 1,
    borderBottomRightRadius: 8,
  },
  singleButton: {
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
});
