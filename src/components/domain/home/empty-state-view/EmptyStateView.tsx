import { StyleSheet, View } from "react-native";

import { TestID } from "@/constants";
import { useTheme } from "@/theme";

import { Text } from "../../../ui/text/Text";

interface EmptyStateViewProps {
  message: string;
}

export const EmptyStateView = ({ message }: EmptyStateViewProps) => {
  const { theme } = useTheme();

  return (
    <View style={styles.container} testID={TestID.EmptyStateView}>
      <Text
        variant="body1"
        weight="medium"
        color={theme.colors.textPrimary}
        align="center"
      >
        {message}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
});
