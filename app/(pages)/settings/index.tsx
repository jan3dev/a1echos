import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppBarBlurTarget,
  authenticateBiometric,
  Icon,
  InAppBanner,
  ListItem,
  Screen,
  SettingsFooter,
  Text,
  Toggle,
  TopAppBar,
} from "@/components";
import { AppConstants, Routes, TestID } from "@/constants";
import { useLocalization, useScrollSurface } from "@/hooks";
import { AppTheme, getModelInfo } from "@/models";
import {
  useBiometricAuthEnabled,
  useSelectedModelId,
  useSelectedTheme,
  useSetBiometricAuthEnabled,
  useShowGlobalTooltip,
} from "@/stores";
import { useTheme } from "@/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<View>(null);
  const { scrolled, onScroll } = useScrollSurface();

  const selectedModelId = useSelectedModelId();
  const selectedTheme = useSelectedTheme();
  const biometricAuthEnabled = useBiometricAuthEnabled();
  const setBiometricAuthEnabled = useSetBiometricAuthEnabled();
  const showGlobalTooltip = useShowGlobalTooltip();

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
              paddingBottom: insets.bottom,
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
              <ListItem
                testID={TestID.SettingsModel}
                title={loc.title}
                titleTrailing={modelDisplay}
                titleTrailingColor={secondary}
                iconLeading={<Icon name="sound" size={24} color={secondary} />}
                iconTrailing={chevron}
                onPress={() => router.push(Routes.settingsModel)}
              />
              <ListItem
                testID={TestID.SettingsAdvanced}
                title={loc.advancedSettingsTitle}
                iconLeading={
                  <Icon name="setting_3" size={24} color={secondary} />
                }
                iconTrailing={chevron}
                onPress={() => router.push(Routes.settingsAdvanced)}
              />
            </View>

            <View style={styles.section}>
              <Text variant="body2" weight="medium" color={secondary}>
                {loc.settingsSectionAppearance}
              </Text>
              <ListItem
                testID={TestID.SettingsTheme}
                title={loc.themeTitle}
                titleTrailing={themeDisplay}
                titleTrailingColor={secondary}
                iconLeading={<Icon name="theme" size={24} color={secondary} />}
                iconTrailing={chevron}
                onPress={() => router.push(Routes.settingsTheme)}
              />
              <ListItem
                testID={TestID.SettingsTextAppearance}
                title={loc.textAppearanceTitle}
                iconLeading={<Icon name="text" size={24} color={secondary} />}
                iconTrailing={chevron}
                onPress={() => router.push(Routes.settingsTextAppearance)}
              />
            </View>

            <View style={styles.section}>
              <ListItem
                testID={TestID.SettingsBiometricAuthToggle}
                title={loc.biometricAuthTitle}
                iconLeading={
                  <Icon
                    name="biometric_fingerprint"
                    size={24}
                    color={secondary}
                  />
                }
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
                testID={TestID.SettingsContactSupport}
                title={loc.contactSupport}
                iconLeading={
                  <Icon name="help_support" size={24} color={secondary} />
                }
                iconTrailing={chevron}
                onPress={() =>
                  Linking.openURL(
                    "https://a1lab.zendesk.com/hc/en-us/requests/new",
                  )
                }
              />
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
    paddingBottom: 24,
  },
  spacer: {
    flexGrow: 1,
  },
});
