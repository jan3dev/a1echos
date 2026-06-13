import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Icon,
  InAppBanner,
  ListItem,
  Screen,
  SettingsFooter,
  TopAppBar,
} from "@/components";
import { AppConstants, Routes, TestID } from "@/constants";
import { useLocalization } from "@/hooks";
import { AppTheme, getModelInfo } from "@/models";
import {
  useSelectedLanguage,
  useSelectedModelId,
  useSelectedTheme,
} from "@/stores";
import { useTheme } from "@/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();

  const selectedModelId = useSelectedModelId();
  const selectedTheme = useSelectedTheme();
  const selectedLanguage = useSelectedLanguage();

  const modelDisplay = getModelInfo(selectedModelId).name;

  const themeDisplay = (() => {
    switch (selectedTheme) {
      case AppTheme.AUTO:
        return loc.auto;
      case AppTheme.LIGHT:
        return loc.light;
      case AppTheme.DARK:
        return loc.dark;
      default:
        return loc.auto;
    }
  })();

  const languageDisplay = selectedLanguage.code.toUpperCase();

  return (
    <Screen>
      <TopAppBar title={loc.settingsTitle} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + AppConstants.APP_BAR_HEIGHT + 16,
            paddingBottom: insets.bottom,
            flexGrow: 1,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.list}>
          <ListItem
            testID={TestID.SettingsModel}
            title={loc.title}
            titleTrailing={modelDisplay}
            titleTrailingColor={theme.colors.textSecondary}
            iconLeading={
              <Icon
                name="voice_circle"
                size={24}
                color={theme.colors.textSecondary}
              />
            }
            iconTrailing={
              <Icon
                name="chevron_right"
                size={24}
                color={theme.colors.textSecondary}
              />
            }
            onPress={() => router.push(Routes.settingsModel)}
          />

          <ListItem
            testID={TestID.SettingsTheme}
            title={loc.themeTitle}
            titleTrailing={themeDisplay}
            titleTrailingColor={theme.colors.textSecondary}
            iconLeading={
              <Icon name="theme" size={24} color={theme.colors.textSecondary} />
            }
            iconTrailing={
              <Icon
                name="chevron_right"
                size={24}
                color={theme.colors.textSecondary}
              />
            }
            onPress={() => router.push(Routes.settingsTheme)}
          />

          <ListItem
            testID={TestID.SettingsLanguage}
            title={loc.spokenLanguageTitle}
            titleTrailing={languageDisplay}
            titleTrailingColor={theme.colors.textSecondary}
            iconLeading={
              <Icon
                name="language"
                size={24}
                color={theme.colors.textSecondary}
              />
            }
            iconTrailing={
              <Icon
                name="chevron_right"
                size={24}
                color={theme.colors.textSecondary}
              />
            }
            onPress={() => router.push(Routes.settingsLanguage)}
          />

          <ListItem
            testID={TestID.SettingsAdvanced}
            title={loc.advancedSettingsTitle}
            iconLeading={
              <Icon
                name="settings"
                size={24}
                color={theme.colors.textSecondary}
              />
            }
            iconTrailing={
              <Icon
                name="chevron_right"
                size={24}
                color={theme.colors.textSecondary}
              />
            }
            onPress={() => router.push(Routes.settingsAdvanced)}
          />

          <ListItem
            testID={TestID.SettingsContactSupport}
            title={loc.contactSupport}
            iconLeading={
              <Icon
                name="help_support"
                size={24}
                color={theme.colors.textSecondary}
              />
            }
            iconTrailing={
              <Icon
                name="chevron_right"
                size={24}
                color={theme.colors.textSecondary}
              />
            }
            onPress={() =>
              Linking.openURL("https://a1lab.zendesk.com/hc/en-us/requests/new")
            }
          />
        </View>

        <View style={styles.bannerContainer}>
          <InAppBanner />
        </View>
        <View style={styles.spacer} />
        <SettingsFooter />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
  },
  list: {
    gap: 16,
  },
  bannerContainer: {
    paddingTop: 24,
  },
  spacer: {
    flexGrow: 1,
  },
});
