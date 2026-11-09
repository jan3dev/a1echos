import Constants from "expo-constants";
import * as IntentLauncher from "expo-intent-launcher";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type HostInstance,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppBarBlurTarget,
  authenticateBiometric,
  Icon,
  type IconName,
  InAppBanner,
  ListItem,
  ListItemGroup,
  Screen,
  SettingsFooter,
  Text,
  Toggle,
  TopAppBar,
} from "@/components";
import { AppConstants, Routes, TestID } from "@/constants";
import { useLocalization, useScrollSurface } from "@/hooks";
import { AppTheme } from "@/models";
import {
  useBiometricAuthEnabled,
  useSelectedTheme,
  useSetBiometricAuthEnabled,
  useShowGlobalTooltip,
} from "@/stores";
import { useTheme } from "@/theme";

// Per-app language settings exist on iOS and on Android 13+ (API 33).
const hasAppLanguageSettings = () =>
  Platform.OS === "ios" ||
  (Platform.OS === "android" && Number(Platform.Version) >= 33);

const openAppLanguageSettings = () =>
  Platform.OS === "android"
    ? IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.APP_LOCALE_SETTINGS,
        { data: `package:${Constants.expoConfig?.android?.package}` },
      )
    : Linking.openSettings();

export default function SettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<HostInstance>(null);
  const { scrolled, onScroll } = useScrollSurface();

  const selectedTheme = useSelectedTheme();
  const biometricAuthEnabled = useBiometricAuthEnabled();
  const setBiometricAuthEnabled = useSetBiometricAuthEnabled();
  const showGlobalTooltip = useShowGlobalTooltip();

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

  const handleBiometricToggle = async (next: boolean) => {
    const result = await authenticateBiometric(loc.biometricAuthPrompt);
    if (result === "success") {
      void setBiometricAuthEnabled(next);
    } else if (result === "unavailable") {
      showGlobalTooltip(loc.biometricAuthUnavailable, "error", 5000);
    }
  };

  const secondary = theme.colors.textSecondary;
  const chevron = <Icon name="chevron_right" size={18} color={secondary} />;
  const leading = (name: IconName) => (
    <Icon name={name} size={24} color={secondary} />
  );

  return (
    <Screen>
      {/* Bars render after content so Android's blur target ref is populated
          before the bar's BlurView mounts and resolves its `blurTarget`. */}
      <AppBarBlurTarget targetRef={blurTargetRef} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + AppConstants.APP_BAR_HEIGHT + 16,
              paddingBottom: insets.bottom + 48,
              flexGrow: 1,
              backgroundColor: theme.colors.surfaceBackground,
            },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.sections}>
            <View style={styles.section}>
              <Text variant="body2" weight="medium" color={secondary}>
                {loc.settingsSectionTranscription}
              </Text>
              <ListItemGroup>
                <ListItem
                  grouped
                  testID={TestID.SettingsModel}
                  title={loc.title}
                  iconLeading={leading("sound")}
                  iconTrailing={chevron}
                  onPress={() => router.push(Routes.settingsModel)}
                />
                <ListItem
                  grouped
                  testID={TestID.SettingsIntelligence}
                  title={loc.intelligenceTitle}
                  iconLeading={leading("ai")}
                  iconTrailing={chevron}
                  onPress={() => router.push(Routes.settingsIntelligence)}
                />
                <ListItem
                  grouped
                  testID={TestID.SettingsAdvanced}
                  title={loc.advancedSettingsTitle}
                  iconLeading={leading("setting_3")}
                  iconTrailing={chevron}
                  onPress={() => router.push(Routes.settingsAdvanced)}
                />
              </ListItemGroup>
            </View>

            <View style={styles.section}>
              <Text variant="body2" weight="medium" color={secondary}>
                {loc.settingsSectionAppearance}
              </Text>
              <ListItemGroup>
                <ListItem
                  grouped
                  testID={TestID.SettingsTheme}
                  title={loc.themeTitle}
                  titleTrailing={themeDisplay}
                  iconLeading={leading("theme")}
                  iconTrailing={chevron}
                  onPress={() => router.push(Routes.settingsTheme)}
                />
                <ListItem
                  grouped
                  testID={TestID.SettingsTextAppearance}
                  title={loc.textAppearanceTitle}
                  iconLeading={leading("text")}
                  iconTrailing={chevron}
                  onPress={() => router.push(Routes.settingsTextAppearance)}
                />
                {hasAppLanguageSettings() && (
                  <ListItem
                    grouped
                    testID={TestID.SettingsAppLanguage}
                    title={loc.appLanguageTitle}
                    titleTrailing={i18n.language.toUpperCase()}
                    iconLeading={leading("globe")}
                    iconTrailing={chevron}
                    onPress={() => void openAppLanguageSettings()}
                  />
                )}
              </ListItemGroup>
            </View>

            <View style={styles.section}>
              <Text variant="body2" weight="medium" color={secondary}>
                {loc.settingsSectionGeneral}
              </Text>
              <ListItemGroup>
                <ListItem
                  grouped
                  testID={TestID.SettingsBiometricAuthToggle}
                  title={loc.biometricAuthTitle}
                  iconLeading={leading("biometric_fingerprint")}
                  iconTrailing={
                    <Toggle
                      value={biometricAuthEnabled}
                      onValueChange={handleBiometricToggle}
                      accessibilityLabel={loc.biometricAuthTitle}
                    />
                  }
                  onPress={() => handleBiometricToggle(!biometricAuthEnabled)}
                />
                <ListItem
                  grouped
                  testID={TestID.SettingsContactSupport}
                  title={loc.contactSupport}
                  iconLeading={leading("help_support")}
                  iconTrailing={chevron}
                  onPress={() =>
                    Linking.openURL(
                      "https://a1lab.zendesk.com/hc/en-us/requests/new",
                    )
                  }
                />
              </ListItemGroup>
            </View>
          </View>

          <View style={styles.bannerContainer}>
            <InAppBanner />
          </View>
          <View style={styles.spacer} />
          <SettingsFooter />
        </ScrollView>
      </AppBarBlurTarget>

      <TopAppBar
        title={loc.settingsTitle}
        blurTarget={blurTargetRef}
        scrolled={scrolled}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
  },
  sections: {
    gap: 24,
  },
  section: {
    gap: 16,
  },
  bannerContainer: {
    paddingTop: 48,
    paddingBottom: 48,
  },
  spacer: {
    flexGrow: 1,
  },
});
