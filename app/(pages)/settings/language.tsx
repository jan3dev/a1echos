import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FlagIcon, ListItem, Radio, Screen, TopAppBar } from "@/components";
import { AppConstants, dynamicTestID } from "@/constants";
import { useLocalization } from "@/hooks";
import {
  getCountryCode,
  getModelInfo,
  SpokenLanguage,
  SupportedLanguages,
} from "@/models";
import {
  useSelectedLanguage,
  useSelectedModelId,
  useSetLanguage,
} from "@/stores";
import { delay, FeatureFlag, logError } from "@/utils";

export default function LanguageSettingsScreen() {
  const router = useRouter();
  const { loc } = useLocalization();
  const insets = useSafeAreaInsets();

  const selectedLanguage = useSelectedLanguage();
  const selectedModelId = useSelectedModelId();
  const setLanguage = useSetLanguage();

  const [pendingLanguageCode, setPendingLanguageCode] = useState<string | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const effectiveLanguageCode = pendingLanguageCode ?? selectedLanguage.code;

  const handleSelect = async (language: SpokenLanguage) => {
    if (language.code === selectedLanguage.code) {
      router.back();
      return;
    }
    if (isSaving) return;

    setPendingLanguageCode(language.code);
    setIsSaving(true);

    const feedback = delay(400);
    try {
      await setLanguage(language);
      await feedback;
      router.back();
    } catch (error) {
      setPendingLanguageCode(null);
      setIsSaving(false);
      logError(error, {
        flag: FeatureFlag.settings,
        message: "Failed to set language",
      });
    }
  };

  const modelInfo = getModelInfo(selectedModelId);
  const languages = SupportedLanguages.forCodes(
    modelInfo.supportedLanguageCodes,
  );

  return (
    <Screen>
      <TopAppBar title={loc.spokenLanguageTitle} />

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
        <View style={styles.list}>
          {languages.map((language) => (
            <ListItem
              key={language.code}
              testID={dynamicTestID.language(language.code)}
              title={language.name}
              iconLeading={
                <FlagIcon name={getCountryCode(language)} size={24} />
              }
              iconTrailing={
                <Radio<string>
                  value={language.code}
                  size="small"
                  groupValue={effectiveLanguageCode}
                  onValueChange={
                    isSaving ? undefined : () => handleSelect(language)
                  }
                  enabled={!isSaving}
                />
              }
              onPress={isSaving ? undefined : () => handleSelect(language)}
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
  },
  list: {
    gap: 8,
  },
});
