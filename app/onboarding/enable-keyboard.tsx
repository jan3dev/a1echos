import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";

import { EnableKeyboardScreen, Toast } from "@/components";
import { useToast } from "@/components/ui/toast/useToast";
import { Routes } from "@/constants";
import { useKeyboardSettingsCheck, useOnboardingExit } from "@/hooks";

export default function EnableKeyboard() {
  const router = useRouter();
  const { resumed } = useLocalSearchParams<{ resumed?: string }>();
  const { show, toastState } = useToast();
  const { confirmSkip } = useOnboardingExit(show);
  const continueOnboarding = useCallback(
    () => router.push(Routes.onboardingSpokenLanguage),
    [router],
  );
  const { goToSettings, checking } = useKeyboardSettingsCheck({
    onAdded: continueOnboarding,
    showToast: show,
    resumed: !!resumed,
  });

  return (
    <>
      <EnableKeyboardScreen
        testID="enable-keyboard"
        onBack={router.back}
        onSkip={confirmSkip}
        onGoToSettings={goToSettings}
        checking={checking}
      />
      <Toast {...toastState} />
    </>
  );
}
