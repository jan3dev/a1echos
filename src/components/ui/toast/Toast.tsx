import { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { getShadow, useTheme } from "@/theme";

import { Icon } from "../icon/Icon";
import { RipplePressable } from "../ripple-pressable/RipplePressable";
import { Text } from "../text/Text";

export type ToastVariant = "info" | "warning" | "error";

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
  durationMs?: number;
  onDismiss: () => void;
}

const BORDER_RADIUS = 8;
const COUNTDOWN_BAR_HEIGHT = 4;

export const Toast = ({
  visible,
  title,
  message,
  primaryButtonText,
  onPrimaryButtonTap,
  secondaryButtonText,
  onSecondaryButtonTap,
  variant = "info",
  titleMaxLines = 1,
  messageMaxLines = 2,
  durationMs,
  onDismiss,
}: ToastProps) => {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const colors = theme.colors;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const countdownAnim = useRef(new Animated.Value(1)).current;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const prevVisibleRef = useRef(visible);

  // Reset during render — before Animated.View commits — so the first frame
  // after the modal mounts is off-screen. Resetting in useEffect runs after
  // paint, so a stuck value (e.g. 1 from an interrupted hide) shows the toast
  // at its final position for one frame before it jumps and slides in.
  if (visible && !prevVisibleRef.current) {
    slideAnim.setValue(0);
  }
  prevVisibleRef.current = visible;

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

  useEffect(() => {
    if (!visible || !durationMs || durationMs <= 0) {
      countdownAnim.stopAnimation();
      return;
    }

    countdownAnim.setValue(1);
    const animation = Animated.timing(countdownAnim, {
      toValue: 0,
      duration: durationMs,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) {
        onDismissRef.current();
      }
    });

    return () => {
      animation.stop();
    };
    // countdownAnim is from useRef and is referentially stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, durationMs]);

  const variantConfig = (() => {
    switch (variant) {
      case "error":
        return { iconName: "danger" as const, iconColor: colors.accentDanger };
      case "warning":
        return {
          iconName: "warning" as const,
          iconColor: colors.accentWarning,
        };
      default:
        return {
          iconName: "info_circle" as const,
          iconColor: colors.textPrimary,
        };
    }
  })();

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  const opacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const hasButtons = primaryButtonText !== undefined;
  const showCountdown = durationMs !== undefined && durationMs > 0;
  const maxWidth = width >= 768 ? 343 : undefined;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
      supportedOrientations={["portrait", "portrait-upside-down", "landscape"]}
    >
      <Pressable style={styles.modalOverlay} onPress={onDismiss}>
        <Animated.View
          style={[
            styles.container,
            getShadow("toast"),
            {
              transform: [{ translateY }],
              opacity,
              maxWidth,
              backgroundColor: colors.surfacePrimary,
              borderRadius: BORDER_RADIUS,
            },
          ]}
        >
          <Pressable>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.glassSurface,
                  borderColor: colors.glassSurfaceBorder,
                },
              ]}
            >
              {showCountdown && (
                <View
                  style={[
                    styles.countdownTrack,
                    { backgroundColor: colors.surfaceBorderSecondary },
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.countdownFill,
                      {
                        backgroundColor: colors.surfaceInverse,
                        width: countdownAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0%", "100%"],
                        }),
                      },
                    ]}
                  />
                </View>
              )}
              <View
                style={[
                  styles.contentContainer,
                  {
                    backgroundColor: hasButtons
                      ? colors.surfacePrimary
                      : colors.glassSurfaceSecondary,
                    borderTopLeftRadius: showCountdown ? 0 : BORDER_RADIUS,
                    borderTopRightRadius: showCountdown ? 0 : BORDER_RADIUS,
                    borderBottomLeftRadius: hasButtons ? 0 : BORDER_RADIUS,
                    borderBottomRightRadius: hasButtons ? 0 : BORDER_RADIUS,
                  },
                ]}
              >
                <View style={styles.row}>
                  <Icon
                    name={variantConfig.iconName}
                    size={18}
                    color={variantConfig.iconColor}
                  />
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
                  <RipplePressable
                    onPress={onDismiss}
                    hitSlop={10}
                    rippleColor={colors.ripple}
                    borderless
                  >
                    <Icon
                      name="close"
                      size={18}
                      color={`${colors.textPrimary}80`}
                    />
                  </RipplePressable>
                </View>
              </View>

              {hasButtons && (
                <View
                  style={[
                    styles.buttonsContainer,
                    { backgroundColor: colors.glassSurface },
                  ]}
                >
                  {secondaryButtonText && primaryButtonText ? (
                    <View style={styles.twoButtonRow}>
                      <RipplePressable
                        style={[
                          styles.button,
                          styles.leftButton,
                          { backgroundColor: colors.surfacePrimary },
                        ]}
                        onPress={onSecondaryButtonTap}
                        rippleColor={colors.ripple}
                      >
                        <Text
                          variant="body2"
                          weight="semibold"
                          color={colors.textSecondary}
                        >
                          {secondaryButtonText}
                        </Text>
                      </RipplePressable>
                      <RipplePressable
                        style={[
                          styles.button,
                          styles.rightButton,
                          { backgroundColor: colors.surfacePrimary },
                        ]}
                        onPress={onPrimaryButtonTap}
                        rippleColor={colors.ripple}
                      >
                        <Text
                          variant="body2"
                          weight="semibold"
                          color={colors.textPrimary}
                        >
                          {primaryButtonText}
                        </Text>
                      </RipplePressable>
                    </View>
                  ) : primaryButtonText ? (
                    <RipplePressable
                      style={[
                        styles.button,
                        styles.singleButton,
                        { backgroundColor: colors.surfacePrimary },
                      ]}
                      onPress={onPrimaryButtonTap}
                      rippleColor={colors.ripple}
                    >
                      <Text
                        variant="body2"
                        weight="semibold"
                        color={colors.textPrimary}
                      >
                        {primaryButtonText}
                      </Text>
                    </RipplePressable>
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
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.16)",
    padding: 16,
  },
  container: {
    width: "100%",
  },
  card: {
    borderRadius: BORDER_RADIUS,
    borderWidth: 1,
    overflow: "hidden",
  },
  contentContainer: {
    padding: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  textColumn: {
    flex: 1,
    marginLeft: 16,
  },
  messageSpacing: {
    height: 4,
  },
  buttonsContainer: {
    borderBottomLeftRadius: BORDER_RADIUS,
    borderBottomRightRadius: BORDER_RADIUS,
    overflow: "hidden",
    paddingTop: 1,
  },
  twoButtonRow: {
    flexDirection: "row",
    gap: 1,
  },
  button: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  leftButton: {
    flex: 1,
    borderBottomLeftRadius: BORDER_RADIUS,
  },
  rightButton: {
    flex: 1,
    borderBottomRightRadius: BORDER_RADIUS,
  },
  singleButton: {
    borderBottomLeftRadius: BORDER_RADIUS,
    borderBottomRightRadius: BORDER_RADIUS,
  },
  countdownTrack: {
    height: COUNTDOWN_BAR_HEIGHT,
    width: "100%",
    overflow: "hidden",
  },
  countdownFill: {
    height: COUNTDOWN_BAR_HEIGHT,
    borderTopRightRadius: BORDER_RADIUS,
    borderBottomRightRadius: BORDER_RADIUS,
  },
});
