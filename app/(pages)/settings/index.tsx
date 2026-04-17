import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Card,
  Divider,
  Icon,
  InAppBanner,
  ListItem,
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
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceBackground },
      ]}
    >
      <TopAppBar title={loc.settingsTitle} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + AppConstants.APP_BAR_HEIGHT + 16,
            paddingBottom: insets.bottom + 16,
            flexGrow: 1,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <ListItem
            testID={TestID.SettingsModel}
            title={loc.modelTitle}
            titleTrailing={modelDisplay}
            titleTrailingColor={theme.colors.textSecondary}
            iconLeading={
              <Icon name="mic" size={24} color={theme.colors.textSecondary} />
            }
            iconTrailing={
              <Icon
                name="chevron_right"
                size={24}
                color={theme.colors.textSecondary}
              />
            }
            onPress={() => router.push(Routes.settingsModel)}
            backgroundColor={theme.colors.surfacePrimary}
          />

          <Divider color={theme.colors.surfaceBorderPrimary} />

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
            backgroundColor={theme.colors.surfacePrimary}
          />

          <Divider color={theme.colors.surfaceBorderPrimary} />

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
            backgroundColor={theme.colors.surfacePrimary}
          />
        </Card>

        <Card style={{ marginTop: 16 }}>
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
            backgroundColor={theme.colors.surfacePrimary}
          />
        </Card>

        <View style={styles.bannerContainer}>
          <InAppBanner />
        </View>
        <View style={styles.spacer} />
        <SettingsFooter />
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
  bannerContainer: {
    paddingTop: 24,
  },
  spacer: {
    flexGrow: 1,
  },
});
