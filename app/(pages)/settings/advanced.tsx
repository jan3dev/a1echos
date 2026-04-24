import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, ListItem, Text, Toggle, TopAppBar } from "@/components";
import { AppConstants, TestID } from "@/constants";
import { useLocalization } from "@/hooks";
import { useSetSmartSplitEnabled, useSmartSplitEnabled } from "@/stores";
import { useTheme } from "@/theme";

export default function AdvancedSettingsScreen() {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();

  const smartSplitEnabled = useSmartSplitEnabled();
  const setSmartSplitEnabled = useSetSmartSplitEnabled();

  const handleToggle = (next: boolean) => {
    void setSmartSplitEnabled(next);
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceBackground },
      ]}
    >
      <TopAppBar title={loc.advancedSettingsTitle} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + AppConstants.APP_BAR_HEIGHT + 16,
            paddingBottom: insets.bottom + 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <ListItem
            testID={TestID.SettingsSmartSplitToggle}
            title={loc.smartSplitTitle}
            iconTrailing={
              <Toggle
                value={smartSplitEnabled}
                onValueChange={handleToggle}
                accessibilityLabel={loc.smartSplitTitle}
              />
            }
            onPress={() => handleToggle(!smartSplitEnabled)}
            backgroundColor={theme.colors.surfacePrimary}
          />
        </Card>
        <Text
          variant="caption1"
          color={theme.colors.textSecondary}
          style={styles.caption}
        >
          {loc.smartSplitDescription}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  caption: {
    marginTop: 8,
    marginHorizontal: 12,
  },
});
