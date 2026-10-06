import { useEffect } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";

import { useLocalization } from "@/hooks";
import { AquaColors, spacing, useTheme } from "@/theme";

import { Icon } from "../../ui/icon/Icon";
import { Text } from "../../ui/text/Text";

interface NoLanguagesFoundProps {
  query: string;
  /** Pins colors on screens that ignore the app theme. */
  colors?: AquaColors;
}

export const NoLanguagesFound = ({
  query,
  colors: colorsOverride,
}: NoLanguagesFoundProps) => {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const colors = colorsOverride ?? theme.colors;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(loc.noLanguagesFoundTitle);
  }, [loc.noLanguagesFoundTitle]);

  return (
    <View style={styles.container} testID="no-languages-found" accessible>
      <View style={[styles.ring, { backgroundColor: colors.surfaceTertiary }]}>
        <View
          style={[styles.ring, { backgroundColor: colors.surfaceSecondary }]}
        >
          <Icon name="search" size={24} color={colors.textSecondary} />
        </View>
      </View>
      <View style={styles.text}>
        <Text
          variant="h4"
          weight="medium"
          align="center"
          color={colors.textPrimary}
        >
          {loc.noLanguagesFoundTitle}
        </Text>
        <Text variant="body1" align="center" color={colors.textSecondary}>
          {loc.noLanguagesFoundDescription(query.trim())}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  ring: {
    padding: spacing.md,
    borderRadius: 300,
  },
  text: {
    alignItems: "center",
    gap: spacing.sm,
  },
});
