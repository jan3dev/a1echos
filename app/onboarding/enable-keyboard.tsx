import { useRouter } from "expo-router";

import { EnableKeyboardScreen, Toast } from "@/components";
import { useToast } from "@/components/ui/toast/useToast";
import { Routes } from "@/constants";
import { useLocalization } from "@/hooks";
import { useMarkWelcomeSeen } from "@/stores";
import { openKeyboardSettings } from "@/utils";

export default function EnableKeyboard() {
  const router = useRouter();
  const { loc } = useLocalization();
  const markWelcomeSeen = useMarkWelcomeSeen();
  const { show, toastState } = useToast();

  const finishOnboarding = () => {
    void markWelcomeSeen();
    // Pushes from Welcome/AllowMicrophone are still on the stack.
    if (router.canDismiss()) router.dismissAll();
    router.replace(Routes.home);
  };

  const handleGoToSettings = async () => {
    // Failure is already logged; Skip remains as the way out.
    if (await openKeyboardSettings()) finishOnboarding();
  };

  const handleSkip = () => {
    show({
      title: loc.onboardingSkipConfirmTitle,
      message: loc.onboardingSkipConfirmMessage,
      variant: "warning",
      messageMaxLines: 3,
      primaryButtonText: loc.onboardingSkip,
      onPrimaryButtonTap: finishOnboarding,
      secondaryButtonText: loc.cancel,
    });
  };

  return (
    <>
      <EnableKeyboardScreen
        testID="enable-keyboard"
        onBack={router.back}
        onSkip={handleSkip}
        onGoToSettings={handleGoToSettings}
      />
      <Toast {...toastState} />
    </>
  );
}
