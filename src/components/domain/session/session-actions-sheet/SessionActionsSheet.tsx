import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TestID } from "@/constants";
import { useLocalization } from "@/hooks";
import { getShadow, useTheme } from "@/theme";
import { formatDate, formatSessionSubtitle } from "@/utils";

import { ListItem } from "../../../shared/list-item/ListItem";
import { Icon } from "../../../ui/icon/Icon";
import { Dimmer } from "../../../ui/modal/Dimmer";
import { Text } from "../../../ui/text/Text";

export interface SessionActionsSheetProps {
  visible: boolean;
  title: string;
  createdAt: Date;
  modifiedAt: Date;
  onRename: () => void;
  onDelete: () => void;
  onDismiss: () => void;
  testID?: string;
}

export const SessionActionsSheet = ({
  visible,
  title,
  createdAt,
  modifiedAt,
  onRename,
  onDelete,
  onDismiss,
  testID,
}: SessionActionsSheetProps) => {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const didOpenRef = useRef(false);

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
          friction: 11,
        })
      : Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        });
    anim.start();
    return () => anim.stop();
  }, [visible, slideAnim]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [screenHeight, 0],
  });

  const opacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const modifiedLabel = useMemo(
    () =>
      formatSessionSubtitle({
        now: new Date(),
        created: createdAt,
        lastModified: modifiedAt,
        modifiedPrefix: loc.modifiedPrefix,
      }),
    [createdAt, modifiedAt, loc.modifiedPrefix],
  );

  return (
    <Dimmer visible={visible} onDismiss={onDismiss}>
      <View style={styles.overlay}>
        <Animated.View
          testID={testID}
          style={[
            styles.sheet,
            getShadow("modal"),
            {
              backgroundColor: theme.colors.surfaceBackground,
              borderColor: theme.colors.surfaceBorderPrimary,
              paddingBottom: bottomInset,
              transform: [{ translateY }],
              opacity,
            },
          ]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.grabberSlot}>
              <View
                style={[
                  styles.grabber,
                  { backgroundColor: theme.colors.systemBackgroundColor },
                ]}
              />
            </View>

            <View style={styles.header}>
              <Text
                variant="subtitle"
                weight="semibold"
                align="center"
                color={theme.colors.textPrimary}
                numberOfLines={1}
              >
                {title}
              </Text>
              <Text
                variant="body2"
                weight="medium"
                align="center"
                color={theme.colors.textSecondary}
                style={styles.createdLine}
              >
                {`${loc.createdPrefix}: ${formatDate(createdAt)}`}
              </Text>
              <Text
                variant="caption1"
                weight="medium"
                align="center"
                color={theme.colors.textTertiary}
                style={styles.modifiedLine}
              >
                {modifiedLabel}
              </Text>
            </View>

            <View style={styles.rows}>
              <ListItem
                testID={TestID.SessionRename}
                title={loc.sessionRenameTitle}
                iconLeading={
                  <Icon
                    name="edit"
                    size={24}
                    color={theme.colors.textSecondary}
                  />
                }
                iconTrailing={
                  <Icon
                    name="chevron_right"
                    size={18}
                    color={theme.colors.textSecondary}
                  />
                }
                onPress={onRename}
              />

              <ListItem
                testID={TestID.SessionDelete}
                title={loc.delete}
                titleColor={theme.colors.accentDanger}
                iconLeading={
                  <Icon
                    name="trash"
                    size={24}
                    color={theme.colors.accentDanger}
                  />
                }
                iconTrailing={
                  <Icon
                    name="chevron_right"
                    size={18}
                    color={theme.colors.accentDanger}
                  />
                }
                onPress={onDelete}
              />
            </View>
          </Pressable>
        </Animated.View>
      </View>
    </Dimmer>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
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
  header: {
    paddingHorizontal: 16,
    alignItems: "center",
  },
  createdLine: {
    marginTop: 8,
  },
  modifiedLine: {
    marginTop: 4,
  },
  rows: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    gap: 16,
  },
});
