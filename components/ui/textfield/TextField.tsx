import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  TextInputProps as RNTextInputProps,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AquaTypography, getShadow, useTheme } from "@/theme";
import { FeatureFlag, logError } from "@/utils";

import { Icon } from "../icon/Icon";

export type TextFieldVariant = "default" | "brand";

interface TextFieldProps {
  label?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  variant?: TextFieldVariant;
  keyboardType?: RNTextInputProps["keyboardType"];
  assistiveText?: string;
  error?: boolean;
  enabled?: boolean;
  maxLength?: number;
  showClearIcon?: boolean;
  onClear?: () => void;
  showPasteIcon?: boolean;
  onPaste?: (text: string) => void;
  debounceTime?: number;
  forceFocus?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const LABEL_ANIMATION_DURATION = 200;
const LINE_HEIGHT = 24;
const PADDING = 16;
const TEXTFIELD_HEIGHT = LINE_HEIGHT + PADDING * 2;
const LABEL_TOP_POSITION_ACTIVE = 12;
const LABEL_LEFT_POSITION = 16;
const LABEL_OFFSET_ACTIVE = 16;
const TRAILING_ICON_RIGHT = 16;
const CONTENT_HORIZONTAL_PADDING = 16;
const CONTENT_VERTICAL_PADDING = 8;
const CONTENT_TRAILING_PADDING = 12;
const ICON_SIZE = 18;
const ICON_SPACING = 16;
const ASSISTIVE_TEXT_TOP_PADDING = 4;
const BORDER_RADIUS = 8;
const DEFAULT_DEBOUNCE = 500;
const FORCE_FOCUS_DELAY = 100;

export const TextField = ({
  label,
  value = "",
  onChangeText,
  variant = "default",
  keyboardType,
  assistiveText,
  error = false,
  enabled = true,
  maxLength,
  showClearIcon = false,
  onClear,
  showPasteIcon = false,
  onPaste,
  debounceTime = DEFAULT_DEBOUNCE,
  forceFocus = false,
  accessibilityLabel,
  accessibilityHint,
}: TextFieldProps) => {
  const { theme } = useTheme();
  const colors = theme.colors;

  const [internalFocus, setInternalFocus] = useState(false);
  const isFocused = forceFocus || internalFocus;

  const [text, setText] = useState(value);
  const inputRef = useRef<TextInput>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const labelAnimation = useRef(new Animated.Value(value ? 1 : 0)).current;

  const hasText = text.length > 0;
  const isLabelActive = isFocused || hasText;

  useEffect(() => {
    if (forceFocus) {
      const timer = setTimeout(
        () => inputRef.current?.focus(),
        FORCE_FOCUS_DELAY,
      );
      return () => clearTimeout(timer);
    }
  }, [forceFocus]);

  useEffect(() => {
    Animated.timing(labelAnimation, {
      toValue: isLabelActive ? 1 : 0,
      duration: LABEL_ANIMATION_DURATION,
      useNativeDriver: false,
    }).start();
  }, [isLabelActive, labelAnimation]);

  useEffect(() => {
    setText(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleChangeText = (newText: string) => {
    setText(newText);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      onChangeText?.(newText);
    }, debounceTime);
  };

  const handleClear = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setText("");
    onChangeText?.("");
    onClear?.();
  };

  const handlePaste = async () => {
    let clipboardText: string;
    try {
      clipboardText = await Clipboard.getStringAsync();
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.ui,
        message: "Failed to read clipboard",
      });
      return;
    }
    if (!clipboardText) return;
    const next =
      maxLength != null ? clipboardText.slice(0, maxLength) : clipboardText;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setText(next);
    onChangeText?.(next);
    onPaste?.(next);
  };

  const labelTop = labelAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [
      (TEXTFIELD_HEIGHT - LINE_HEIGHT) / 2,
      LABEL_TOP_POSITION_ACTIVE,
    ],
  });

  const labelFontSize = labelAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [
      AquaTypography.body1.fontSize,
      AquaTypography.caption2SemiBold.fontSize,
    ],
  });

  const showClear = showClearIcon && hasText;
  const trailingIconCount = (showClear ? 1 : 0) + (showPasteIcon ? 1 : 0);

  const calculateTrailingPadding = () => {
    if (trailingIconCount === 0) return CONTENT_TRAILING_PADDING;
    const iconsWidth =
      trailingIconCount * ICON_SIZE + (trailingIconCount - 1) * ICON_SPACING;
    return TRAILING_ICON_RIGHT + iconsWidth + ICON_SPACING;
  };

  const borderColor = !enabled
    ? "transparent"
    : error
      ? colors.accentDanger
      : variant === "brand"
        ? colors.accentBrand
        : "transparent";

  const labelColor = enabled ? colors.textSecondary : colors.textTertiary;

  const textColor = enabled ? colors.textPrimary : colors.textTertiary;
  const iconColor = colors.textSecondary;

  const pasteIconRight = TRAILING_ICON_RIGHT;
  const clearIconRight = showPasteIcon
    ? TRAILING_ICON_RIGHT + ICON_SIZE + ICON_SPACING
    : TRAILING_ICON_RIGHT;

  return (
    <View style={[styles.wrapper, { opacity: enabled ? 1 : 0.5 }]}>
      <View
        style={[
          styles.shadowContainer,
          getShadow("input"),
          {
            backgroundColor: colors.surfacePrimary,
            height: TEXTFIELD_HEIGHT,
          },
        ]}
      >
        <View style={[styles.container, { borderColor, borderWidth: 1 }]}>
          <Pressable
            onPress={() => enabled && inputRef.current?.focus()}
            style={styles.pressableContainer}
          >
            {label && (
              <Animated.Text
                style={[
                  styles.label,
                  {
                    left: LABEL_LEFT_POSITION,
                    top: labelTop,
                    fontSize: labelFontSize,
                    color: labelColor,
                    fontFamily: isLabelActive
                      ? AquaTypography.caption2SemiBold.fontFamily
                      : AquaTypography.body1.fontFamily,
                  },
                ]}
              >
                {label}
              </Animated.Text>
            )}

            <View
              style={[
                styles.inputWrapper,
                {
                  marginTop: label ? LABEL_OFFSET_ACTIVE : 0,
                  paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
                  paddingVertical: CONTENT_VERTICAL_PADDING,
                  paddingRight: calculateTrailingPadding(),
                },
              ]}
            >
              <TextInput
                ref={inputRef}
                accessibilityLabel={accessibilityLabel || label}
                accessibilityHint={accessibilityHint || assistiveText}
                style={[
                  styles.input,
                  AquaTypography.body1,
                  { color: textColor, height: "100%" },
                ]}
                value={text}
                onChangeText={handleChangeText}
                onFocus={() => setInternalFocus(true)}
                onBlur={() => setInternalFocus(false)}
                keyboardType={keyboardType}
                editable={enabled}
                maxLength={maxLength}
                cursorColor={colors.accentBrand}
                underlineColorAndroid="transparent"
                textAlignVertical="top"
                disableFullscreenUI
              />
            </View>

            {trailingIconCount > 0 && (
              <View style={styles.trailingContainer}>
                {showClear && (
                  <Pressable
                    onPress={enabled ? handleClear : undefined}
                    style={[styles.iconButton, { right: clearIconRight }]}
                    accessibilityRole="button"
                    accessibilityLabel="Clear text"
                  >
                    <View
                      style={[
                        styles.clearIconBackground,
                        { backgroundColor: colors.surfaceTertiary },
                      ]}
                    >
                      <Icon name="close" size={14} color={iconColor} />
                    </View>
                  </Pressable>
                )}
                {showPasteIcon && (
                  <Pressable
                    onPress={enabled ? handlePaste : undefined}
                    style={[styles.iconButton, { right: pasteIconRight }]}
                    accessibilityRole="button"
                    accessibilityLabel="Paste from clipboard"
                  >
                    <Icon name="paste" size={ICON_SIZE} color={iconColor} />
                  </Pressable>
                )}
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {assistiveText && (
        <View
          style={[
            styles.assistiveRow,
            { marginTop: ASSISTIVE_TEXT_TOP_PADDING },
          ]}
        >
          <Text
            style={[
              AquaTypography.caption1Medium,
              {
                color: error ? colors.accentDanger : colors.textSecondary,
                flex: 1,
              },
            ]}
          >
            {assistiveText}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  shadowContainer: {
    borderRadius: BORDER_RADIUS,
  },
  container: {
    flex: 1,
    borderRadius: BORDER_RADIUS,
  },
  pressableContainer: {
    flex: 1,
    position: "relative",
  },
  label: {
    position: "absolute",
    zIndex: 1,
  },
  inputWrapper: {
    flex: 1,
  },
  input: {
    padding: 0,
    margin: 0,
  },
  trailingContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    justifyContent: "center",
  },
  iconButton: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  clearIconBackground: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  assistiveRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
