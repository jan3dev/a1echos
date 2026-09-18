import { useRouter } from "expo-router";

import { AllowMicrophoneScreen, Toast } from "@/components";
import { useToast } from "@/components/ui/toast/useToast";
import { Routes } from "@/constants";
import { useLocalization, useMicPermission } from "@/hooks";
import { useMarkWelcomeSeen } from "@/stores";

export default function AllowMicrophone() {
  const router = useRouter();
  const { loc } = useLocalization();
  const markWelcomeSeen = useMarkWelcomeSeen();
  const { show, hide, toastState } = useToast();
  const ensureMicPermission = useMicPermission(show, hide);

  const finishOnboarding = () => {
    void markWelcomeSeen();
    // Push from Welcome is still on the stack; replace alone would keep it.
    if (router.canDismiss()) router.dismissAll();
    router.replace(Routes.home);
  };

  const handleAllow = async () => {
    if (await ensureMicPermission()) finishOnboarding();
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
      <AllowMicrophoneScreen
        testID="allow-microphone"
        onBack={router.back}
        onSkip={handleSkip}
        onAllow={handleAllow}
      />
      <Toast {...toastState} />
    </>
  );
}
