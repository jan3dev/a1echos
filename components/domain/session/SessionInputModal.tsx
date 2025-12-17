import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { AppConstants } from '@/constants';
import { useLocalization } from '@/hooks';
import { getShadow, useTheme } from '@/theme';

import { Button } from '../../ui/button/Button';
import { Icon } from '../../ui/icon/Icon';
import { Dimmer } from '../../ui/modal/Dimmer';
import { Text } from '../../ui/text/Text';
import { TextField } from '../../ui/textfield/TextField';

interface SessionInputModalProps {
  visible: boolean;
  title: string;
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
  buttonText,
  initialValue = '',
  onSubmit,
  onCancel,
}: SessionInputModalProps) => {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const { height: screenHeight } = useWindowDimensions();
  const [text, setText] = useState(initialValue);

  const slideAnim = useRef(new Animated.Value(screenHeight)).current;

  useEffect(() => {
    if (visible) {
      setText(initialValue);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(screenHeight);
    }
  }, [visible, initialValue, screenHeight, slideAnim]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (
      (trimmed.length > 0 || initialValue.length > 0) &&
      trimmed.length <= (AppConstants.SESSION_NAME_MAX_LENGTH || 50)
    ) {
      onSubmit(trimmed);
    }
  };

  const containerWidth = '100%';

  return (
    <Dimmer visible={visible} onDismiss={onCancel || (() => {})}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.overlay}>
          <Animated.View
            style={[
              styles.container,
              {
                backgroundColor: theme.colors.surfacePrimary,
                width: containerWidth,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.header}>
                <Text
                  variant="subtitle"
                  weight="semibold"
                  color={theme.colors.textPrimary}
                  align="center"
                  style={styles.title}
                >
                  {title}
                </Text>
                <Pressable
                  onPress={onCancel || (() => {})}
                  hitSlop={10}
                  style={styles.closeButton}
                >
                  <Icon
                    name="close"
                    size={24}
                    color={theme.colors.textSecondary}
                  />
                </Pressable>
              </View>

              <View style={styles.content}>
                <TextField
                  label={loc.sessionNameLabel}
                  value={text}
                  onChangeText={setText}
                  maxLength={AppConstants.SESSION_NAME_MAX_LENGTH || 50}
                  assistiveText={loc.sessionNameMaxLengthHelper}
                  showClearIcon
                  onClear={() => setText('')}
                  transparentBorder={true}
                  forceFocus={visible}
                />

                <View style={styles.spacer} />

                <Button.primary text={buttonText} onPress={handleSubmit} />
              </View>
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Dimmer>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
    ...getShadow('modal'),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48,
    position: 'relative',
    minHeight: 24,
  },
  title: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  content: {
    width: '100%',
  },
  spacer: {
    height: 48,
  },
});
