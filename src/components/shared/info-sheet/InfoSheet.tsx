import { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TestID } from "@/constants";
import { useLocalization } from "@/hooks";
import { getShadow, useTheme } from "@/theme";
import { iosPressed } from "@/utils";

import { Button } from "../../ui/button/Button";
import { Icon } from "../../ui/icon/Icon";
import { Dimmer } from "../../ui/modal/Dimmer";
import { useSwipeToDismiss } from "../../ui/modal/useSwipeToDismiss";
import { Text } from "../../ui/text/Text";

export interface InfoSheetProps {
  visible: boolean;
  title: string;
  message: string;
  onDismiss: () => void;
}

export const InfoSheet = ({
  visible,
  title,
  message,
  onDismiss,
}: InfoSheetProps) => {
  const { theme } = useTheme();
  const colors = theme.colors;
  const { loc } = useLocalization();
  const { bottom } = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const didOpenRef = useRef(false);
  const { dragY, panHandlers } = useSwipeToDismiss(visible, onDismiss);

  useEffect(() => {
    if (!visible && !didOpenRef.current) {
      return;
    }
    didOpenRef.current = true;
    const anim = visible
      ? Animated.spring(slideAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 10,
        })
      : Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        });
    anim.start();
    return () => anim.stop();
  }, [visible, slideAnim]);

  const translateY = Animated.add(
    slideAnim.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }),
    dragY,
  );

  return (
    <Dimmer visible={visible} onDismiss={onDismiss}>
      <View style={styles.wrapper}>
        <Animated.View
          testID={TestID.InfoSheet}
          {...panHandlers}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfacePrimary,
              paddingBottom: bottom,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.grabber}>
            <View
              style={[
                styles.grabberPill,
                { backgroundColor: colors.systemBackgroundColor },
              ]}
            />
          </View>
          <View style={styles.header}>
            <Icon name="info_circle" size={24} color={colors.textPrimary} />
            <Text
              variant="subtitle"
              weight="semibold"
              color={colors.textPrimary}
              numberOfLines={2}
              accessibilityRole="header"
              style={styles.headerTitle}
            >
              {title}
            </Text>
            <Pressable
              testID={TestID.InfoSheetClose}
              onPress={onDismiss}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={loc.close}
              style={({ pressed }) => ({ opacity: iosPressed(pressed) })}
            >
              <Icon name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Text variant="body1" color={colors.textSecondary}>
              {message}
            </Text>
            <Button.primary text={loc.gotIt} onPress={onDismiss} />
          </ScrollView>
        </Animated.View>
      </View>
    </Dimmer>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    paddingHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...getShadow("surface"),
  },
  grabber: {
    height: 13,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  grabberPill: {
    width: 48,
    height: 5,
    borderRadius: 100,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    marginTop: 16,
  },
  headerTitle: {
    flex: 1,
  },
  scroll: {
    maxHeight: 551,
    flexGrow: 0,
  },
  scrollContent: {
    gap: 24,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
});
