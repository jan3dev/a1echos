import { useRouter } from 'expo-router';
import { Fragment } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Divider,
  FlagIcon,
  ListItem,
  Radio,
  Text,
  TopAppBar,
} from '@/components';
import { useLocalization } from '@/hooks';
import { getCountryCode, SpokenLanguage, SupportedLanguages } from '@/models';
import { useSelectedLanguage, useSetLanguage } from '@/stores';
import { getShadow, useTheme } from '@/theme';

const APP_BAR_HEIGHT = 60;

export default function LanguageSettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();

  const selectedLanguage = useSelectedLanguage();
  const setLanguage = useSetLanguage();

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
            getShadow('card'),
            { backgroundColor: theme.colors.surfacePrimary },
          ]}
        >
          {languages.map((language, index) => (
            <Fragment key={language.code}>
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
            </Fragment>
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
  },
});
