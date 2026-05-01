import { ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Card,
  Icon,
  ListItem,
  Screen,
  Text,
  Toggle,
  TopAppBar,
} from "@/components";
import { AppConstants, TestID } from "@/constants";
import { useLocalization } from "@/hooks";
import {
  useSetSmartSplitEnabled,
  useShowKeyboardPrompt,
  useSmartSplitEnabled,
} from "@/stores";
import { useTheme } from "@/theme";

export default function AdvancedSettingsScreen() {
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();

  const smartSplitEnabled = useSmartSplitEnabled();
  const setSmartSplitEnabled = useSetSmartSplitEnabled();
  const showKeyboardPrompt = useShowKeyboardPrompt();

  const handleToggle = (next: boolean) => {
    void setSmartSplitEnabled(next);
  };

  return (
    <Screen>
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

        <Card style={styles.cardSpacing}>
          <ListItem
            testID={TestID.SettingsAddKeyboardRow}
            title={loc.advancedSettingsAddKeyboardTitle}
            iconTrailing={
              <Icon
                name="chevron_right"
                size={20}
                color={theme.colors.textSecondary}
              />
            }
            onPress={showKeyboardPrompt}
            backgroundColor={theme.colors.surfacePrimary}
          />
        </Card>
        <Text
          variant="caption1"
          color={theme.colors.textSecondary}
          style={styles.caption}
        >
          {loc.advancedSettingsAddKeyboardDescription}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
  },
  caption: {
    marginTop: 8,
    marginHorizontal: 12,
  },
  cardSpacing: {
    marginTop: 24,
  },
});
