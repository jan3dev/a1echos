import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  LayoutChangeEvent,
  PixelRatio,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppConstants, TestID } from "@/constants";
import { useKeyboardHeight, useLocalization } from "@/hooks";
import { getShadow, useTheme } from "@/theme";
import { iosPressed } from "@/utils";

import { Button } from "../../../ui/button/Button";
import { Icon } from "../../../ui/icon/Icon";
import { Dimmer } from "../../../ui/modal/Dimmer";
import { RipplePressable } from "../../../ui/ripple-pressable/RipplePressable";
import { Text } from "../../../ui/text/Text";
import { TextField } from "../../../ui/textfield/TextField";

// Minimum gap kept between the bottom of the modal and the top of the keyboard
// before the centered card lifts off its resting position.
const KEYBOARD_GAP = 16;

interface SessionInputModalProps {
  visible: boolean;
  title: string;
  label?: string;
  buttonText: string;
  initialValue?: string;
  onSubmit: (text: string) => void;
  onCancel?: () => void;
  showCancelButton?: boolean;
  cancelButtonText?: string;
}

export const SessionInputModal = ({
  visible,
  title,
  label,
  buttonText,
  initialValue = "",
  onSubmit,
  onCancel,
}: SessionInputModalProps) => {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const { width, height: screenHeight } = useWindowDimensions();
  const { top: topInset } = useSafeAreaInsets();
  const [text, setText] = useState(initialValue);
  const [modalHeight, setModalHeight] = useState(0);
  const keyboardHeight = useKeyboardHeight();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const keyboardOffset = useRef(new Animated.Value(0)).current;

  const maxLength = AppConstants.SESSION_NAME_MAX_LENGTH || 50;

  useEffect(() => {
    if (visible) {
      setText(initialValue);
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 8,
      }).start();
    } else {
      slideAnim.setValue(0);
      keyboardOffset.setValue(0);
    }
  }, [visible, initialValue, slideAnim, keyboardOffset]);

  // Keep the modal centered, lifting it just enough to preserve KEYBOARD_GAP
  // above the keyboard when the centered position would otherwise overlap it.
  useEffect(() => {
    if (modalHeight === 0) return;
    const center = screenHeight / 2;
    const modalBottom = center + modalHeight / 2;
    const keyboardTop = screenHeight - keyboardHeight;
    let shift = 0;
    if (keyboardHeight > 0) {
      const overlap = modalBottom + KEYBOARD_GAP - keyboardTop;
      if (overlap > 0) {
        // Never lift the modal under the status bar / notch.
        const minTop = KEYBOARD_GAP + topInset;
        const maxShift = Math.max(0, center - modalHeight / 2 - minTop);
        // Snap to the pixel grid: a fractional translate makes the 1px field
        // border rasterize thicker on one edge.
        shift = PixelRatio.roundToNearestPixel(Math.min(overlap, maxShift));
      }
    }
    Animated.timing(keyboardOffset, {
      toValue: -shift,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [keyboardHeight, modalHeight, screenHeight, topInset, keyboardOffset]);

  const entranceTranslate = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });
  const translateY = Animated.add(entranceTranslate, keyboardOffset);
  const opacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const modalWidth = width >= 768 ? 343 : width - 32;

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const height = e.nativeEvent.layout.height;
    setModalHeight((prev) => (prev === height ? prev : height));
  }, []);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (
      (trimmed.length > 0 || initialValue.length > 0) &&
      trimmed.length <= maxLength
    ) {
      onSubmit(trimmed);
    }
  };

  return (
    <Dimmer visible={visible} onDismiss={() => onCancel?.()}>
      <View style={styles.overlay}>
        <Animated.View
          testID={TestID.SessionInputModalCard}
          onLayout={handleLayout}
          style={[
            styles.container,
            getShadow("modal"),
            {
              width: modalWidth,
              backgroundColor: theme.colors.surfaceBackground,
              transform: [{ translateY }],
              opacity,
            },
          ]}
        >
          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Pressable
              testID={TestID.SessionInputModal}
              onPress={(e) => e.stopPropagation()}
              style={styles.card}
            >
              <View style={styles.header}>
                <View style={styles.titleRow}>
                  <Text
                    variant="subtitle"
                    weight="semibold"
                    color={theme.colors.textPrimary}
                    style={styles.title}
                  >
                    {title}
                  </Text>
                  <RipplePressable
                    testID={TestID.SessionInputModalClose}
                    onPress={onCancel}
                    hitSlop={10}
                    rippleColor={theme.colors.ripple}
                    borderless
                    accessibilityRole="button"
                    accessibilityLabel={loc.close}
                    style={({ pressed }) => ({ opacity: iosPressed(pressed) })}
                  >
                    <Icon
                      name="close"
                      size={24}
                      color={theme.colors.textPrimary}
                    />
                  </RipplePressable>
                </View>
                <Text
                  variant="body1"
                  weight="medium"
                  color={theme.colors.textSecondary}
                  style={styles.helper}
                >
                  {loc.sessionNameMaxLengthHelper}
                </Text>
              </View>

              <TextField
                label={label ?? loc.sessionNameLabel}
                value={text}
                onChangeText={setText}
                variant="brand"
                maxLength={maxLength}
                showClearIcon
                onClear={() => setText("")}
                forceFocus={visible}
                debounceTime={0}
              />

              <View style={styles.spacer} />

              <Button.primary text={buttonText} onPress={handleSubmit} />
            </Pressable>
          </ScrollView>
        </Animated.View>
      </View>
    </Dimmer>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    borderRadius: 16,
    maxHeight: "100%",
    overflow: "hidden",
  },
  scroll: {
    flexGrow: 0,
  },
  card: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  header: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  title: {
    flex: 1,
  },
  helper: {
    marginTop: 4,
  },
  spacer: {
    height: 24,
  },
});
