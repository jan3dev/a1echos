import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppConstants, TestID } from "@/constants";
import { useLocalization } from "@/hooks";
import { getShadow, useTheme } from "@/theme";

import { Button } from "../../../ui/button/Button";
import { Dimmer } from "../../../ui/modal/Dimmer";
import { Text } from "../../../ui/text/Text";
import { TextField } from "../../../ui/textfield/TextField";

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
  initialValue = "",
  onSubmit,
  onCancel,
}: SessionInputModalProps) => {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const { height: screenHeight } = useWindowDimensions();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const [text, setText] = useState(initialValue);
  const keyboardVisibleRef = useRef(false);

  const slideAnim = useRef(new Animated.Value(screenHeight)).current;

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      keyboardVisibleRef.current = true;
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      keyboardVisibleRef.current = false;
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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

  const handleDismiss = useCallback(() => {
    if (keyboardVisibleRef.current) {
      Keyboard.dismiss();
      return;
    }
    onCancel?.();
  }, [onCancel]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (
      (trimmed.length > 0 || initialValue.length > 0) &&
      trimmed.length <= (AppConstants.SESSION_NAME_MAX_LENGTH || 50)
    ) {
      onSubmit(trimmed);
    }
  };

  return (
    <Dimmer visible={visible} onDismiss={handleDismiss}>
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : -46}
      >
        <View style={styles.overlay}>
          <Animated.View
            style={[
              styles.container,
              getShadow("modal"),
              {
                backgroundColor: theme.colors.surfaceBackground,
                borderColor: theme.colors.surfaceBorderPrimary,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={{ paddingBottom: bottomInset + 32 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <Pressable
                testID={TestID.SessionInputModal}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.grabberSlot}>
                  <View
                    testID={TestID.SessionInputModalGrabber}
                    style={[
                      styles.grabber,
                      { backgroundColor: theme.colors.systemBackgroundColor },
                    ]}
                  />
                </View>

                <View style={styles.content}>
                  <Text
                    variant="subtitle"
                    weight="semibold"
                    color={theme.colors.textPrimary}
                    align="center"
                    style={styles.title}
                  >
                    {title}
                  </Text>

                  <TextField
                    label={loc.sessionNameLabel}
                    value={text}
                    onChangeText={setText}
                    variant="brand"
                    maxLength={AppConstants.SESSION_NAME_MAX_LENGTH || 50}
                    assistiveText={loc.sessionNameMaxLengthHelper}
                    showClearIcon
                    onClear={() => setText("")}
                    forceFocus={visible}
                    debounceTime={0}
                  />

                  <View style={styles.spacer} />

                  <Button.primary text={buttonText} onPress={handleSubmit} />
                </View>
              </Pressable>
            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Dimmer>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "stretch",
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    maxHeight: "100%",
  },
  scroll: {
    flexGrow: 0,
  },
  grabberSlot: {
    paddingTop: 8,
    paddingBottom: 32,
    alignItems: "center",
  },
  grabber: {
    width: 48,
    height: 5,
    borderRadius: 100,
  },
  content: {
    paddingHorizontal: 16,
  },
  title: {
    marginBottom: 32,
  },
  spacer: {
    height: 32,
  },
});
