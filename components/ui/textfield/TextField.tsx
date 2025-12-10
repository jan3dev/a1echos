import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  TextInputProps as RNTextInputProps,
  StyleSheet,
  Text,
  TextInput,
  TextInputContentSizeChangeEvent,
  View,
} from 'react-native';
import { getShadow, useTheme } from '../../../theme';
import { AquaTypography } from '../../../theme/typography';
import { Icon } from '../icon';

interface TextFieldProps {
  label?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  trailingIcon?: React.ReactNode;
  onTrailingPress?: () => void;
  secureTextEntry?: boolean;
  keyboardType?: RNTextInputProps['keyboardType'];
  assistiveText?: string;
  error?: boolean;
  enabled?: boolean;
  multiline?: boolean;
  minLines?: number;
  maxLines?: number;
  maxLength?: number;
  showCounter?: boolean;
  showClearIcon?: boolean;
  onClear?: () => void;
  debounceTime?: number;
  forceFocus?: boolean;
  transparentBorder?: boolean;
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
const TRAILING_ICON_PADDING = 40;
const CONTENT_TRAILING_PADDING = 12;
const ASSISTIVE_TEXT_TOP_PADDING = 4;
const CLEAR_ICON_SPACING = 16;
const BORDER_RADIUS = 8;
const DEFAULT_DEBOUNCE = 500;

export const TextField = ({
  label,
  value = '',
  onChangeText,
  trailingIcon,
  onTrailingPress,
  secureTextEntry = false,
  keyboardType,
  assistiveText,
  error = false,
  enabled = true,
  multiline = false,
  minLines = 1,
  maxLines = 1,
  maxLength,
  showCounter = false,
  showClearIcon = false,
  onClear,
  debounceTime = DEFAULT_DEBOUNCE,
  forceFocus = false,
  transparentBorder = false,
  accessibilityLabel,
  accessibilityHint,
}: TextFieldProps) => {
  const { theme } = useTheme();
  const colors = theme.colors;

  const [internalFocus, setInternalFocus] = useState(false);
  const isFocused = forceFocus || internalFocus;

  const [text, setText] = useState(value);
  const [contentHeight, setContentHeight] = useState(LINE_HEIGHT * minLines);
  const inputRef = useRef<TextInput>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const labelAnimation = useRef(new Animated.Value(value ? 1 : 0)).current;

  const hasText = text.length > 0;
  const isLabelActive = isFocused || hasText;
  const isMultiline = multiline || minLines > 1 || maxLines > 1;

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
    setText('');
    onChangeText?.('');
    onClear?.();
  };

  const handleContentSizeChange = (e: TextInputContentSizeChangeEvent) => {
    if (isMultiline) {
      const newHeight = e.nativeEvent.contentSize.height;
      setContentHeight(newHeight);
    }
  };

  const labelTop = labelAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [
      isMultiline ? PADDING : (TEXTFIELD_HEIGHT - LINE_HEIGHT) / 2,
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

  // Calculate container height based on content and min/max lines
  const effectiveMaxLines = Math.max(maxLines, minLines);
  const minContentHeight = minLines * LINE_HEIGHT;
  const maxContentHeight = effectiveMaxLines * LINE_HEIGHT;

  let calculatedHeight = contentHeight;
  if (calculatedHeight < minContentHeight) calculatedHeight = minContentHeight;
  if (maxLines > 1 && calculatedHeight > maxContentHeight)
    calculatedHeight = maxContentHeight;

  const containerHeight = isMultiline
    ? Math.max(
        minLines * LINE_HEIGHT + PADDING * 2,
        calculatedHeight + PADDING + (isLabelActive ? LABEL_OFFSET_ACTIVE : 0)
      )
    : TEXTFIELD_HEIGHT;

  const calculateTrailingPadding = () => {
    const hasClearIcon = showClearIcon && hasText;
    const hasTrailing = trailingIcon !== undefined;

    if (hasClearIcon && hasTrailing) {
      return TRAILING_ICON_PADDING + 18 + CLEAR_ICON_SPACING;
    } else if (hasClearIcon || hasTrailing) {
      return TRAILING_ICON_PADDING;
    }
    return CONTENT_TRAILING_PADDING;
  };

  const borderColor = error
    ? colors.accentDanger
    : isFocused
    ? transparentBorder
      ? 'transparent'
      : colors.accentBrand
    : 'transparent';

  const labelColor =
    error && !isMultiline
      ? colors.accentDanger
      : enabled
      ? colors.textSecondary
      : colors.textTertiary;

  const textColor = enabled ? colors.textPrimary : colors.textTertiary;

  return (
    <View style={[styles.wrapper, { opacity: enabled ? 1 : 0.5 }]}>
      <Pressable onPress={() => enabled && inputRef.current?.focus()}>
        <Animated.View
          style={[
            styles.container,
            getShadow('input'),
            {
              height: containerHeight,
              backgroundColor: colors.surfacePrimary,
              borderColor,
              borderWidth: 1,
            },
          ]}
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
                { color: textColor, height: '100%' },
              ]}
              value={text}
              onChangeText={handleChangeText}
              onFocus={() => setInternalFocus(true)}
              onBlur={() => setInternalFocus(false)}
              secureTextEntry={secureTextEntry}
              keyboardType={keyboardType}
              editable={enabled}
              multiline={isMultiline}
              maxLength={maxLength}
              onContentSizeChange={handleContentSizeChange}
              cursorColor={colors.accentBrand}
              underlineColorAndroid="transparent"
              textAlignVertical="top"
            />
          </View>

          {((showClearIcon && hasText) || trailingIcon) && (
            <View style={styles.trailingContainer}>
              {showClearIcon && hasText && (
                <Pressable
                  onPress={enabled ? handleClear : undefined}
                  style={[
                    styles.clearIcon,
                    {
                      right: trailingIcon
                        ? TRAILING_ICON_RIGHT + CLEAR_ICON_SPACING + 18
                        : TRAILING_ICON_RIGHT,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.clearIconBackground,
                      { backgroundColor: colors.surfaceTertiary },
                    ]}
                  >
                    <Icon name="close" size={14} color={colors.textSecondary} />
                  </View>
                </Pressable>
              )}
              {trailingIcon && (
                <Pressable
                  onPress={enabled ? onTrailingPress : undefined}
                  style={[styles.trailingIcon, { right: TRAILING_ICON_RIGHT }]}
                >
                  {trailingIcon}
                </Pressable>
              )}
            </View>
          )}
        </Animated.View>
      </Pressable>

      {(assistiveText || showCounter) && (
        <View
          style={[
            styles.assistiveRow,
            { marginTop: ASSISTIVE_TEXT_TOP_PADDING },
          ]}
        >
          {assistiveText && (
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
          )}
          {showCounter && maxLength && (
            <Text
              style={[
                AquaTypography.caption1Medium,
                { color: colors.textTertiary },
              ]}
            >
              {text.length}/{maxLength}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  container: {
    borderRadius: BORDER_RADIUS,
    position: 'relative',
  },
  label: {
    position: 'absolute',
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
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    justifyContent: 'center',
  },
  clearIcon: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearIconBackground: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trailingIcon: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assistiveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
