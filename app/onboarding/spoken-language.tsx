import { useRouter } from "expo-router";
import { useState } from "react";

import { SpokenLanguageScreen, Toast } from "@/components";
import { useToast } from "@/components/ui/toast/useToast";
import { Routes } from "@/constants";
import { useOnboardingExit } from "@/hooks";
import {
  getModelInfo,
  shouldSuggestLargerModel,
  SpokenLanguage,
  SupportedLanguages,
} from "@/models";
import {
  useMarkLargerModelSuggestionSeen,
  useSelectedLanguage,
  useSelectedModelId,
  useSetLanguage,
} from "@/stores";

export default function SpokenLanguageOnboarding() {
  const router = useRouter();
  const selectedLanguage = useSelectedLanguage();
  const selectedModelId = useSelectedModelId();
  const setLanguage = useSetLanguage();
  const { show, toastState } = useToast();
  const { confirmSkip } = useOnboardingExit(show);
  const markLargerModelSuggestionSeen = useMarkLargerModelSuggestionSeen();
  const [selected, setSelected] = useState<SpokenLanguage>(selectedLanguage);
  const [isSaving, setIsSaving] = useState(false);

  const languages = SupportedLanguages.forCodes(
    getModelInfo(selectedModelId).supportedLanguageCodes,
  );

  const handleNext = async () => {
    let languageCode = selectedLanguage.code;
    if (selected.code !== selectedLanguage.code) {
      setIsSaving(true);
      try {
        await setLanguage(selected);
        languageCode = selected.code;
      } catch {
        // The store already logged it; language stays changeable in Settings.
      }
      setIsSaving(false);
    }
    // Stands in for the Settings suggestion sheet. Uses the saved language,
    // since the next screen recommends a model for it.
    if (shouldSuggestLargerModel(languageCode, selectedModelId)) {
      void markLargerModelSuggestionSeen();
      router.push(Routes.onboardingTryLargerModel);
    } else {
      router.push(Routes.onboardingTutorialIntro);
    }
  };

  return (
    <>
      <SpokenLanguageScreen
        testID="spoken-language"
        languages={languages}
        selectedCode={selected.code}
        onSelect={setSelected}
        onBack={router.back}
        onSkip={confirmSkip}
        onNext={handleNext}
        isSaving={isSaving}
      />
      <Toast {...toastState} />
    </>
  );
}
