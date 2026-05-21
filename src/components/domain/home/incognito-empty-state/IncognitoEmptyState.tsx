import { StyleSheet, View } from "react-native";

import { TestID } from "@/constants";
import { useLocalization } from "@/hooks";
import { useTheme } from "@/theme";

import { Icon } from "../../../ui/icon/Icon";
import { Text } from "../../../ui/text/Text";

export const IncognitoEmptyState = () => {
  const { theme } = useTheme();
  const { loc } = useLocalization();

  return (
    <View style={styles.container} testID={TestID.IncognitoEmptyState}>
      <Icon name="ghost" size={64} color={theme.colors.textTertiary} />
      <Text
        variant="h5"
        weight="semibold"
        align="center"
        color={theme.colors.textPrimary}
      >
        {loc.incognitoEmptyStateTitle}
      </Text>
      <Text variant="body1" align="center" color={theme.colors.textSecondary}>
        {loc.incognitoEmptyStateDescription}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 16,
  },
});
