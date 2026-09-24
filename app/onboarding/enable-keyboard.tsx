import { useRouter } from "expo-router";

import { EnableKeyboardScreen, Toast } from "@/components";
import { useToast } from "@/components/ui/toast/useToast";
import { Routes } from "@/constants";
import { useOnboardingExit } from "@/hooks";
import { openKeyboardSettings } from "@/utils";

export default function EnableKeyboard() {
  const router = useRouter();
  const { show, toastState } = useToast();
  const { confirmSkip } = useOnboardingExit(show);

  const handleGoToSettings = async () => {
    // Failure is already logged; Skip remains as the way out.
    if (await openKeyboardSettings())
      router.push(Routes.onboardingSpokenLanguage);
  };

  return (
    <>
      <EnableKeyboardScreen
        testID="enable-keyboard"
        onBack={router.back}
        onSkip={confirmSkip}
        onGoToSettings={handleGoToSettings}
      />
      <Toast {...toastState} />
    </>
  );
}
