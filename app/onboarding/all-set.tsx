import { useRouter } from "expo-router";

import { AllSetScreen } from "@/components";
import { useOnboardingExit } from "@/hooks";

export default function AllSet() {
  const router = useRouter();
  const { finishOnboarding } = useOnboardingExit();

  return (
    <AllSetScreen
      testID="all-set"
      onBack={router.back}
      onGetStarted={finishOnboarding}
    />
  );
}
