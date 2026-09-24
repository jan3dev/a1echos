import { useRouter } from "expo-router";
import { useState } from "react";

import { SpokenLanguageScreen, Toast } from "@/components";
import { useToast } from "@/components/ui/toast/useToast";
import { useOnboardingExit } from "@/hooks";
import { getModelInfo, SpokenLanguage, SupportedLanguages } from "@/models";
import {
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
  const { finishOnboarding, confirmSkip } = useOnboardingExit(show);
  const [selected, setSelected] = useState<SpokenLanguage>(selectedLanguage);
  const [isSaving, setIsSaving] = useState(false);

  const languages = SupportedLanguages.forCodes(
    getModelInfo(selectedModelId).supportedLanguageCodes,
  );

  const handleNext = async () => {
    if (selected.code !== selectedLanguage.code) {
      setIsSaving(true);
      try {
        await setLanguage(selected);
      } catch {
        // The store already logged it; language stays changeable in Settings.
      }
    }
    finishOnboarding();
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
