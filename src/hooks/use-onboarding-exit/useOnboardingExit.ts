import { useRouter } from "expo-router";

import { ToastOptions } from "@/components/ui/toast/useToast";
import { Routes } from "@/constants";
import { useMarkWelcomeSeen } from "@/stores";

import { useLocalization } from "../use-localization/useLocalization";

export const useOnboardingExit = (
  showToast?: (options: ToastOptions) => void,
) => {
  const router = useRouter();
  const { loc } = useLocalization();
  const markWelcomeSeen = useMarkWelcomeSeen();

  const finishOnboarding = () => {
    void markWelcomeSeen();
    // Earlier onboarding pushes are still on the stack; replace alone would keep them.
    if (router.canDismiss()) router.dismissAll();
    router.replace(Routes.home);
  };

  const confirmSkip = () => {
    showToast?.({
      title: loc.onboardingSkipConfirmTitle,
      message: loc.onboardingSkipConfirmMessage,
      variant: "warning",
      messageMaxLines: 3,
      primaryButtonText: loc.onboardingSkip,
      onPrimaryButtonTap: finishOnboarding,
      secondaryButtonText: loc.cancel,
    });
  };

  return { finishOnboarding, confirmSkip };
};
