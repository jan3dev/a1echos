import { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { useTheme } from "@/theme";

import { Text } from "../text/Text";

export type ChipSize = "small" | "large";

export interface ChipProps {
  label: string;
  size?: ChipSize;
  iconLeading?: ReactNode;
  backgroundColor?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const Chip = ({
  label,
  size = "large",
  iconLeading,
  backgroundColor,
  textColor,
  style,
  testID,
}: ChipProps) => {
  const { colors } = useTheme().theme;
  const isSmall = size === "small";

  const containerStyle = isSmall
    ? [
        styles.small,
        { backgroundColor: backgroundColor ?? colors.accentBrandTransparent },
      ]
    : [
        styles.large,
        {
          backgroundColor: backgroundColor ?? colors.surfacePrimary,
          borderColor: colors.surfaceBorderPrimary,
        },
      ];

  const labelColor = isSmall
    ? (textColor ?? colors.accentBrand)
    : (textColor ?? colors.textSecondary);

  return (
    <View testID={testID} style={[containerStyle, style]}>
      {iconLeading}
      <Text
        variant={isSmall ? "caption1" : "body2"}
        weight="medium"
        color={labelColor}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  small: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 300,
  },
  large: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
});
