import { useRouter } from "expo-router";

import { Toast, TutorialIntroScreen } from "@/components";
import { useToast } from "@/components/ui/toast/useToast";
import { useOnboardingExit } from "@/hooks";

export default function TutorialIntro() {
  const router = useRouter();
  const { show, toastState } = useToast();
  const { finishOnboarding, confirmSkip } = useOnboardingExit(show);

  return (
    <>
      <TutorialIntroScreen
        testID="tutorial-intro"
        onBack={router.back}
        onSkip={confirmSkip}
        // ponytail: tutorial screens don't exist yet; route there once built.
        onNext={finishOnboarding}
      />
      <Toast {...toastState} />
    </>
  );
}
