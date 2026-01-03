import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Divider, ListItem, Radio, TopAppBar } from '@/components';
import { useLocalization } from '@/hooks';
import { AppTheme } from '@/models';
import { useSetTheme } from '@/stores';
import { getShadow, useTheme } from '@/theme';
import { delay, FeatureFlag, logError } from '@/utils';

const APP_BAR_HEIGHT = 60;

export default function ThemeSettingsScreen() {
  const router = useRouter();
  const { theme, selectedTheme, setTheme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();

  const setSettingsTheme = useSetTheme();

  const [pendingTheme, setPendingTheme] = useState<AppTheme | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const effectiveTheme = pendingTheme ?? selectedTheme;

  const handleSelect = async (appTheme: AppTheme) => {
    if (appTheme === selectedTheme) {
      router.back();
      return;
    }
    if (isSaving) return;

    setPendingTheme(appTheme);
    setIsSaving(true);

    const feedback = delay(400);
    try {
      await setTheme(appTheme);
      await setSettingsTheme(appTheme);
      await feedback;
      router.back();
    } catch (error) {
      setPendingTheme(null);
      setIsSaving(false);
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
            styles.shadowContainer,
            getShadow('card'),
            { backgroundColor: theme.colors.surfacePrimary },
          ]}
        >
          <View style={styles.clipContainer}>
            <ListItem
              title={loc.auto}
              iconTrailing={
                <Radio<AppTheme>
                  value={AppTheme.AUTO}
                  groupValue={effectiveTheme}
                  onValueChange={
                    isSaving ? undefined : () => handleSelect(AppTheme.AUTO)
                  }
                  enabled={!isSaving}
                />
              }
              selected={effectiveTheme === AppTheme.AUTO}
              onPress={isSaving ? undefined : () => handleSelect(AppTheme.AUTO)}
              backgroundColor={theme.colors.surfacePrimary}
            />

            <Divider color={theme.colors.surfaceBorderPrimary} />

            <ListItem
              title={loc.light}
              iconTrailing={
                <Radio<AppTheme>
                  value={AppTheme.LIGHT}
                  groupValue={effectiveTheme}
                  onValueChange={
                    isSaving ? undefined : () => handleSelect(AppTheme.LIGHT)
                  }
                  enabled={!isSaving}
                />
              }
              selected={effectiveTheme === AppTheme.LIGHT}
              onPress={
                isSaving ? undefined : () => handleSelect(AppTheme.LIGHT)
              }
              backgroundColor={theme.colors.surfacePrimary}
            />

            <Divider color={theme.colors.surfaceBorderPrimary} />

            <ListItem
              title={loc.dark}
              iconTrailing={
                <Radio<AppTheme>
                  value={AppTheme.DARK}
                  groupValue={effectiveTheme}
                  onValueChange={
                    isSaving ? undefined : () => handleSelect(AppTheme.DARK)
                  }
                  enabled={!isSaving}
                />
              }
              selected={effectiveTheme === AppTheme.DARK}
              onPress={isSaving ? undefined : () => handleSelect(AppTheme.DARK)}
              backgroundColor={theme.colors.surfacePrimary}
            />
          </View>
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
  shadowContainer: {
    borderRadius: 8,
  },
  clipContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
});
