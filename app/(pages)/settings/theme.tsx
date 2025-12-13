import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Divider, ListItem, Radio, TopAppBar } from '@/components';
import { useLocalization } from '@/hooks';
import { AppTheme } from '@/models';
import { useSetTheme } from '@/stores';
import { getShadow, useTheme } from '@/theme';
import { FeatureFlag, logError } from '@/utils';

const APP_BAR_HEIGHT = 60;

export default function ThemeSettingsScreen() {
  const router = useRouter();
  const { theme, selectedTheme, setTheme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();

  const setSettingsTheme = useSetTheme();

  const handleSelect = async (appTheme: AppTheme) => {
    try {
      await setTheme(appTheme);
      await setSettingsTheme(appTheme);
      router.back();
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.settings,
        message: 'Failed to set theme',
      });
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceBackground },
      ]}
    >
      <TopAppBar title={loc.themeTitle} />

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
            getShadow('card'),
            { backgroundColor: theme.colors.surfacePrimary },
          ]}
        >
          <ListItem
            title={loc.auto}
            iconTrailing={
              <Radio<AppTheme>
                value={AppTheme.AUTO}
                groupValue={selectedTheme}
              />
            }
            onPress={() => handleSelect(AppTheme.AUTO)}
            backgroundColor={theme.colors.surfacePrimary}
          />

          <Divider color={theme.colors.surfaceBorderPrimary} />

          <ListItem
            title={loc.light}
            iconTrailing={
              <Radio<AppTheme>
                value={AppTheme.LIGHT}
                groupValue={selectedTheme}
              />
            }
            onPress={() => handleSelect(AppTheme.LIGHT)}
            backgroundColor={theme.colors.surfacePrimary}
          />

          <Divider color={theme.colors.surfaceBorderPrimary} />

          <ListItem
            title={loc.dark}
            iconTrailing={
              <Radio<AppTheme>
                value={AppTheme.DARK}
                groupValue={selectedTheme}
              />
            }
            onPress={() => handleSelect(AppTheme.DARK)}
            backgroundColor={theme.colors.surfacePrimary}
          />
        </View>
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
  card: {
    borderRadius: 8,
    overflow: 'hidden',
  },
});
