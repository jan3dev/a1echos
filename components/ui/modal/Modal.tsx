import { ReactNode, useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { dynamicTestID } from "@/constants";
import { getShadow, useTheme } from "@/theme";

import { Button, ButtonVariant } from "../button/Button";
import { Text } from "../text/Text";

import { Dimmer } from "./Dimmer";

export interface ModalProps {
  visible: boolean;
  title: string;
  message: string;
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
  icon?: ReactNode;
  titleMaxLines?: number;
  messageMaxLines?: number;
  onDismiss?: () => void;
  testID?: string;
}

export const Modal = ({
  visible,
  title,
  message,
  primaryButton,
  secondaryButton,
  icon,
  titleMaxLines = 3,
  messageMaxLines = 5,
  onDismiss,
  testID,
}: ModalProps) => {
  const { width } = useWindowDimensions();
  const { bottom: bottomInset } = useSafeAreaInsets();
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

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  const opacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const modalWidth = width >= 768 ? 343 : width - 32;

  return (
    <Dimmer visible={visible} onDismiss={onDismiss || (() => {})}>
      <View
        style={[
          styles.contentWrapper,
          { paddingBottom: bottomInset + 32, paddingTop: 16 },
        ]}
      >
        <Animated.View
          testID={testID ?? dynamicTestID.modal(title)}
          style={[
            styles.container,
            {
              width: modalWidth,
              transform: [{ translateY }],
              opacity,
              backgroundColor: colors.surfacePrimary,
              borderRadius: 24,
            },
          ]}
        >
          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.surfacePrimary },
                ]}
              >
                <View
                  style={[
                    styles.dragHandle,
                    { backgroundColor: colors.systemBackgroundColor },
                  ]}
                />

                {icon && (
                  <View
                    style={[
                      styles.iconOuterContainer,
                      { backgroundColor: colors.surfaceTertiary },
                    ]}
                  >
                    <View
                      style={[
                        styles.iconInnerContainer,
                        { backgroundColor: colors.surfaceSecondary },
                      ]}
                    >
                      {icon}
                    </View>
                  </View>
                )}

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

                <View style={styles.buttonsSpacing} />

                <Button.primary
                  text={primaryButton.text}
                  variant={primaryButton.variant || "normal"}
                  onPress={primaryButton.onTap}
                />

                {secondaryButton && (
                  <>
                    <View style={styles.secondaryButtonSpacing} />
                    <Button.secondary
                      text={secondaryButton.text}
                      variant={secondaryButton.variant || "normal"}
                      onPress={secondaryButton.onTap}
                    />
                  </>
                )}

                <View style={styles.bottomSpacing} />
              </View>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </View>
    </Dimmer>
  );
};

const styles = StyleSheet.create({
  contentWrapper: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  container: {
    maxHeight: "100%",
    ...getShadow("modal"),
  },
  scroll: {
    flexGrow: 0,
  },
  card: {
    borderRadius: 24,
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  dragHandle: {
    width: 48,
    height: 5,
    borderRadius: 100,
    marginTop: 8,
    alignSelf: "center",
  },
  iconOuterContainer: {
    alignSelf: "center",
    marginTop: 32,
    marginBottom: 24,
    padding: 16,
    borderRadius: 999,
  },
  iconInnerContainer: {
    padding: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  messageSpacing: {
    height: 8,
  },
  messageText: {
    lineHeight: 19.2,
  },
  buttonsSpacing: {
    height: 32,
  },
  secondaryButtonSpacing: {
    height: 16,
  },
  bottomSpacing: {
    height: 24,
  },
});
