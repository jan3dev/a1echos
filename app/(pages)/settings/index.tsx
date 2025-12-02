import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  InAppBanner,
  SettingsFooter,
} from '../../../components/domain/settings';
import { ListItem } from '../../../components/shared/list-item';
import { Divider } from '../../../components/ui/divider';
import { Icon } from '../../../components/ui/icon';
import { TopAppBar } from '../../../components/ui/top-app-bar';
import { useLocalization } from '../../../hooks/useLocalization';
import { AppTheme } from '../../../models/AppTheme';
import { ModelType } from '../../../models/ModelType';
import {
  useSelectedLanguage,
  useSelectedModelType,
  useSelectedTheme,
} from '../../../stores/settingsStore';
import { AquaPrimitiveColors, useTheme } from '../../../theme';

const APP_BAR_HEIGHT = 60;

export default function SettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();

  const selectedModelType = useSelectedModelType();
  const selectedTheme = useSelectedTheme();
  const selectedLanguage = useSelectedLanguage();

  const modelDisplay =
    selectedModelType === ModelType.WHISPER_REALTIME
      ? loc.whisperModelRealtimeTitle
      : loc.whisperModelFileTitle;

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
            paddingTop: insets.top + APP_BAR_HEIGHT + 16,
            paddingBottom: insets.bottom + 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surfacePrimary,
              shadowColor: AquaPrimitiveColors.shadow,
            },
          ]}
        >
          <ListItem
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
            onPress={() => router.push('/settings/model')}
            backgroundColor={theme.colors.surfacePrimary}
          />

          <Divider color={theme.colors.surfaceBorderPrimary} />

          <ListItem
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
            onPress={() => router.push('/settings/theme')}
            backgroundColor={theme.colors.surfacePrimary}
          />

          <Divider color={theme.colors.surfaceBorderPrimary} />

          <ListItem
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
            onPress={() => router.push('/settings/language')}
            backgroundColor={theme.colors.surfacePrimary}
          />
        </View>

        <View style={styles.bannerContainer}>
          <InAppBanner />
        </View>
      </ScrollView>

      <SettingsFooter />
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
  card: {
    borderRadius: 8,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 4,
  },
  bannerContainer: {
    paddingTop: 24,
    paddingBottom: 24,
  },
});
