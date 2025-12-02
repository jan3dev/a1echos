import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListItem } from '../../../components/shared/list-item';
import { Divider } from '../../../components/ui/divider';
import { FlagIcon } from '../../../components/ui/icon';
import { Radio } from '../../../components/ui/radio';
import { Text } from '../../../components/ui/text';
import { TopAppBar } from '../../../components/ui/top-app-bar';
import { useLocalization } from '../../../hooks/useLocalization';
import {
  getCountryCode,
  SpokenLanguage,
  SupportedLanguages,
} from '../../../models/SpokenLanguage';
import {
  useSelectedLanguage,
  useSettingsStore,
} from '../../../stores/settingsStore';
import { AquaPrimitiveColors, useTheme } from '../../../theme';

const APP_BAR_HEIGHT = 60;

export default function LanguageSettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();

  const selectedLanguage = useSelectedLanguage();
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  const handleSelect = async (language: SpokenLanguage) => {
    try {
      await setLanguage(language);
      router.back();
    } catch (error) {
      console.error('Failed to set language:', error);
    }
  };

  const languages = SupportedLanguages.all;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceBackground },
      ]}
    >
      <TopAppBar title={loc.spokenLanguageTitle} />

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
        <Text
          variant="body1"
          color={theme.colors.textPrimary}
          style={styles.description}
        >
          {loc.spokenLanguageDescription}
        </Text>

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surfacePrimary,
              shadowColor: AquaPrimitiveColors.shadow,
            },
          ]}
        >
          {languages.map((language, index) => (
            <React.Fragment key={language.code}>
              {index > 0 && (
                <Divider color={theme.colors.surfaceBorderPrimary} />
              )}
              <ListItem
                title={language.name}
                iconLeading={
                  <FlagIcon name={getCountryCode(language)} size={24} />
                }
                iconTrailing={
                  <Radio<string>
                    value={language.code}
                    groupValue={selectedLanguage.code}
                    onValueChange={() => handleSelect(language)}
                  />
                }
                onPress={() => handleSelect(language)}
                backgroundColor={theme.colors.surfacePrimary}
              />
            </React.Fragment>
          ))}
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
  description: {
    marginBottom: 16,
  },
  card: {
    borderRadius: 8,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 4,
  },
});
