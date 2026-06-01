import { ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, ListItem, Screen, Toggle, TopAppBar } from "@/components";
import { AppConstants, TestID } from "@/constants";
import { useLocalization } from "@/hooks";
import {
  useKeyboardAutocorrect,
  useSetKeyboardAutocorrect,
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
  const keyboardAutocorrect = useKeyboardAutocorrect();
  const setKeyboardAutocorrect = useSetKeyboardAutocorrect();
  const showKeyboardPrompt = useShowKeyboardPrompt();

  const handleToggle = (next: boolean) => {
    void setSmartSplitEnabled(next);
  };

  const handleAutocorrectToggle = (next: boolean) => {
    void setKeyboardAutocorrect(next);
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
        <ListItem
          testID={TestID.SettingsSmartSplitToggle}
          title={loc.smartSplitTitle}
          subtitle={loc.smartSplitDescription}
          iconTrailing={
            <Toggle
              value={smartSplitEnabled}
              onValueChange={handleToggle}
              accessibilityLabel={loc.smartSplitTitle}
            />
          }
          onPress={() => handleToggle(!smartSplitEnabled)}
        />
        <ListItem
          testID={TestID.SettingsKeyboardAutocorrectToggle}
          title={loc.keyboardAutocorrectTitle}
          subtitle={loc.keyboardAutocorrectDescription}
          iconTrailing={
            <Toggle
              value={keyboardAutocorrect}
              onValueChange={handleAutocorrectToggle}
              accessibilityLabel={loc.keyboardAutocorrectTitle}
            />
          }
          onPress={() => handleAutocorrectToggle(!keyboardAutocorrect)}
        />
        <ListItem
          testID={TestID.SettingsAddKeyboardRow}
          title={loc.advancedSettingsAddKeyboardTitle}
          subtitle={loc.advancedSettingsAddKeyboardDescription}
          iconTrailing={
            <Icon
              name="chevron_right"
              size={24}
              color={theme.colors.textSecondary}
            />
          }
          onPress={showKeyboardPrompt}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
});
