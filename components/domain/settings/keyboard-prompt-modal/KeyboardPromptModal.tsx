import { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TestID } from "@/constants";
import { useLocalization } from "@/hooks";
import { getShadow, useTheme } from "@/theme";

import { Button } from "../../../ui/button/Button";
import { Dimmer } from "../../../ui/modal/Dimmer";
import { Text } from "../../../ui/text/Text";

interface KeyboardPromptModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ANDROID_KEYBOARD_IMAGE = require("@/assets/images/android-keyboard.png");
const IOS_KEYBOARD_IMAGE = require("@/assets/images/ios-keyboard.png");

export const KeyboardPromptModal = ({
  visible,
  onConfirm,
  onCancel,
}: KeyboardPromptModalProps) => {
  const { width } = useWindowDimensions();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const slideAnim = useRef(new Animated.Value(0)).current;

  const colors = theme.colors;

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

  const maxWidth = width >= 768 ? 343 : undefined;

  const keyboardImage =
    Platform.OS === "ios" ? IOS_KEYBOARD_IMAGE : ANDROID_KEYBOARD_IMAGE;

  const modalWidth = Math.min(width - 32, maxWidth ?? Infinity);
  const imageWidth = modalWidth - 32;
  const imageAspectRatio = Platform.OS === "ios" ? 750 / 610 : 750 / 588;

  return (
    <Dimmer visible={visible} onDismiss={onCancel}>
      <View style={styles.contentWrapper}>
        <Animated.View
          testID={TestID.KeyboardPromptModal}
          style={[
            styles.container,
            {
              transform: [{ translateY }],
              opacity,
              maxWidth,
              marginBottom: bottomInset + 32,
              backgroundColor: colors.surfacePrimary,
            },
          ]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.dragHandleContainer}>
              <View
                style={[
                  styles.dragHandle,
                  { backgroundColor: colors.systemBackgroundColor },
                ]}
              />
            </View>

            <View style={styles.heroContainer}>
              <Image
                testID={
                  Platform.OS === "ios"
                    ? TestID.KeyboardPromptImageIos
                    : TestID.KeyboardPromptImageAndroid
                }
                source={keyboardImage}
                style={{ width: imageWidth, aspectRatio: imageAspectRatio }}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
            </View>

            <View style={styles.textContainer}>
              <Text
                variant="h4"
                weight="medium"
                size={24}
                color={colors.textPrimary}
                align="center"
              >
                {loc.keyboardPromptTitle}
              </Text>
              <View style={styles.titleSpacing} />
              <Text
                variant="body1"
                weight="regular"
                color={colors.textSecondary}
                align="center"
                style={styles.bodyText}
              >
                {loc.keyboardPromptBody}
              </Text>
              {Platform.OS === "ios" && (
                <>
                  <View style={styles.disclaimerSpacing} />
                  <Text
                    variant="caption1"
                    weight="regular"
                    color={colors.textTertiary}
                    align="center"
                  >
                    {loc.keyboardPromptIosDisclaimer}
                  </Text>
                </>
              )}
            </View>

            <View style={styles.ctas}>
              <Button.primary
                text={loc.keyboardPromptCta}
                onPress={onConfirm}
              />
              <View style={styles.ctaSpacing} />
              <Button.secondary
                text={loc.keyboardPromptDismiss}
                onPress={onCancel}
              />
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
    justifyContent: "flex-end",
    alignItems: "center",
  },
  container: {
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: "hidden",
    alignSelf: "stretch",
    ...getShadow("modal"),
  },
  dragHandleContainer: {
    paddingTop: 8,
    alignItems: "center",
  },
  dragHandle: {
    width: 48,
    height: 5,
    borderRadius: 100,
  },
  heroContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingTop: 32,
  },
  textContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    alignItems: "center",
  },
  titleSpacing: {
    height: 8,
  },
  bodyText: {
    lineHeight: 19.2,
  },
  disclaimerSpacing: {
    height: 12,
  },
  ctas: {
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 24,
  },
  ctaSpacing: {
    height: 16,
  },
});
