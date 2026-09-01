import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppBarBlurTarget,
  FlagIcon,
  ListItem,
  Radio,
  Screen,
  TopAppBar,
} from "@/components";
import { AppConstants, dynamicTestID } from "@/constants";
import { useLocalization, useScrollSurface } from "@/hooks";
import {
  getCountryCode,
  getModelInfo,
  ModelId,
  SpokenLanguage,
  SupportedLanguages,
} from "@/models";
import {
  useHasSeenLargerModelSuggestion,
  useSelectedLanguage,
  useSelectedModelId,
  useSetLanguage,
  useShowLargerModelSuggestion,
} from "@/stores";
import { useTheme } from "@/theme";
import { delay, FeatureFlag, logError } from "@/utils";

export default function LanguageSettingsScreen() {
  const router = useRouter();
  const { loc } = useLocalization();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<View>(null);
  const { scrolled, onScroll } = useScrollSurface();

  const selectedLanguage = useSelectedLanguage();
  const selectedModelId = useSelectedModelId();
  const setLanguage = useSetLanguage();
  const hasSeenLargerModelSuggestion = useHasSeenLargerModelSuggestion();
  const showLargerModelSuggestion = useShowLargerModelSuggestion();

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
      // The bundled model is much weaker outside English, so nudge the user
      // toward a bigger one — once, and only while they're still on it. The
      // sheet is rendered globally because this screen unmounts on `back()`.
      if (
        language.code !== SupportedLanguages.defaultLanguage.code &&
        selectedModelId === ModelId.WHISPER_TINY &&
        !hasSeenLargerModelSuggestion
      ) {
        showLargerModelSuggestion();
      }
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
      {/* Bars render after content so Android's blur target ref is populated
          before the bar's BlurView mounts and resolves its `blurTarget`. */}
      <AppBarBlurTarget targetRef={blurTargetRef} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + AppConstants.APP_BAR_HEIGHT + 16,
              paddingBottom: insets.bottom + 16,
              backgroundColor: theme.colors.surfaceBackground,
            },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
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
      </AppBarBlurTarget>

      <TopAppBar
        title={loc.spokenLanguageTitle}
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
  list: {
    gap: 16,
  },
});
