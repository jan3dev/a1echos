import { useRouter } from "expo-router";

import { DictateScreen, Toast } from "@/components";
import { useToast } from "@/components/ui/toast/useToast";
import { useOnboardingExit } from "@/hooks";

export default function Dictate() {
  const router = useRouter();
  const { show, toastState } = useToast();
  const { finishOnboarding, confirmSkip } = useOnboardingExit(show);

  return (
    <>
      <DictateScreen
        testID="dictate"
        onBack={router.back}
        onSkip={confirmSkip}
        // ponytail: next tutorial screen doesn't exist yet; route there once built.
        onNext={finishOnboarding}
      />
      <Toast {...toastState} />
    </>
  );
}
