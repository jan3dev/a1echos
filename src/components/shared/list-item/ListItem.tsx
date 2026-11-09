import { ReactNode } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

import { dynamicTestID } from "@/constants";
import { AquaColors, useTheme } from "@/theme";
import { iosPressed } from "@/utils";

import { Icon } from "../../ui/icon/Icon";
import { RipplePressable } from "../../ui/ripple-pressable/RipplePressable";
import { Text } from "../../ui/text/Text";

export interface ListItemProps {
  title: string;
  subtitle?: string;
  contentWidget?: ReactNode;
  titleTrailing?: string;
  subtitleTrailing?: string;
  titleColor?: string;
  subtitleColor?: string;
  titleTrailingColor?: string;
  subtitleTrailingColor?: string;
  backgroundColor?: string;
  iconLeading?: ReactNode;
  iconTrailing?: ReactNode;
  selected?: boolean;
  bordered?: boolean;
  /** Row inside a grouped container: square corners, no stroke, 16pt padding, medium title. */
  grouped?: boolean;
  /** Shows an info icon after the title. */
  info?: { onPress: () => void; accessibilityLabel: string };
  onPress?: () => void;
  onLongPress?: () => void;
  titleMaxLines?: number;
  subtitleMaxLines?: number;
  style?: StyleProp<ViewStyle>;
  /** Pins colors on screens that ignore the app theme. */
  colors?: AquaColors;
  testID?: string;
}

export const ListItem = ({
  title,
  subtitle,
  contentWidget,
  titleTrailing,
  subtitleTrailing,
  titleColor,
  subtitleColor,
  titleTrailingColor,
  subtitleTrailingColor,
  backgroundColor,
  iconLeading,
  iconTrailing,
  selected,
  bordered = true,
  grouped = false,
  info,
  onPress,
  onLongPress,
  titleMaxLines = 2,
  subtitleMaxLines = 3,
  style,
  colors: colorsOverride,
  testID,
}: ListItemProps) => {
  const { theme } = useTheme();
  const colors = colorsOverride ?? theme.colors;

  const innerStyle: ViewStyle = {
    backgroundColor: selected
      ? colors.surfaceSelected
      : (backgroundColor ?? colors.surfacePrimary),
    borderColor: !bordered
      ? "transparent"
      : selected
        ? colors.surfaceBorderSelected
        : colors.surfaceBorderPrimary,
    borderWidth: grouped ? 0 : 1,
    borderRadius: grouped ? 0 : 16,
    paddingHorizontal: grouped ? 16 : 12,
    paddingVertical: grouped ? 16 : 15,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  };

  return (
    <View testID={testID} style={style}>
      <RipplePressable
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={!onPress && !onLongPress}
        rippleColor={colors.ripple}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ selected: !!selected, disabled: !onPress }}
        accessibilityActions={
          info ? [{ name: "info", label: info.accessibilityLabel }] : undefined
        }
        onAccessibilityAction={
          info
            ? (e) => e.nativeEvent.actionName === "info" && info.onPress()
            : undefined
        }
        style={({ pressed }) => ({
          opacity: !selected ? iosPressed(pressed) : 1,
          borderRadius: grouped ? 0 : 16,
          overflow: "hidden",
        })}
      >
        <View style={innerStyle}>
          {iconLeading && (
            <View style={styles.leadingContainer}>{iconLeading}</View>
          )}

          <View style={styles.contentContainer}>
            <View style={styles.titleRow}>
              <Text
                variant="body1"
                weight={grouped ? "medium" : "semibold"}
                color={titleColor ?? colors.textPrimary}
                numberOfLines={titleMaxLines}
                style={styles.title}
              >
                {title}
              </Text>
              {info && (
                <Pressable
                  testID={testID && dynamicTestID.listItemInfo(testID)}
                  onPress={info.onPress}
                  hitSlop={13}
                  accessibilityRole="button"
                  accessibilityLabel={info.accessibilityLabel}
                  style={({ pressed }) => ({ opacity: iosPressed(pressed) })}
                >
                  <Icon
                    name="info_circle"
                    size={18}
                    color={colors.textSecondary}
                  />
                </Pressable>
              )}
            </View>

            {contentWidget ? (
              contentWidget
            ) : subtitle ? (
              <Text
                variant="body2"
                weight="medium"
                color={subtitleColor ?? colors.textSecondary}
                numberOfLines={subtitleMaxLines}
                style={styles.subtitle}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>

          <View style={styles.trailingTextContainer}>
            {titleTrailing && (
              <Text
                variant={subtitleTrailing ? "body1" : "body2"}
                weight={subtitleTrailing ? "semibold" : "medium"}
                color={
                  titleTrailingColor ??
                  (subtitleTrailing ? colors.textPrimary : colors.textSecondary)
                }
                align="right"
                numberOfLines={1}
              >
                {titleTrailing}
              </Text>
            )}
            {subtitleTrailing && (
              <Text
                variant="body2"
                weight="medium"
                color={subtitleTrailingColor ?? colors.textSecondary}
                align="right"
                style={styles.subtitle}
              >
                {subtitleTrailing}
              </Text>
            )}
          </View>

          {iconTrailing && (
            <View style={styles.trailingIconContainer}>{iconTrailing}</View>
          )}
        </View>
      </RipplePressable>
    </View>
  );
};

const styles = StyleSheet.create({
  leadingContainer: {
    marginRight: 16,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flexShrink: 1,
  },
  subtitle: {
    marginTop: 4,
  },
  trailingTextContainer: {
    alignItems: "flex-end",
    marginLeft: 8,
  },
  trailingIconContainer: {
    marginLeft: 16,
  },
});
