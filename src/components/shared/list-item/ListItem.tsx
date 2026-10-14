import { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { AquaColors, useTheme } from "@/theme";
import { iosPressed } from "@/utils";

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
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 15,
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
        style={({ pressed }) => ({
          opacity: !selected ? iosPressed(pressed) : 1,
          borderRadius: 16,
          overflow: "hidden",
        })}
      >
        <View style={innerStyle}>
          {iconLeading && (
            <View style={styles.leadingContainer}>{iconLeading}</View>
          )}

          <View style={styles.contentContainer}>
            <Text
              variant="body1"
              weight="semibold"
              color={titleColor ?? colors.textPrimary}
              numberOfLines={titleMaxLines}
            >
              {title}
            </Text>

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
                variant="body1"
                weight="semibold"
                color={titleTrailingColor ?? colors.textPrimary}
                align="right"
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
