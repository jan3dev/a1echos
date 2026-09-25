import { useRouter } from "expo-router";

import { AutocorrectScreen, Toast } from "@/components";
import { useToast } from "@/components/ui/toast/useToast";
import { Routes } from "@/constants";
import { useOnboardingExit } from "@/hooks";

export default function Autocorrect() {
  const router = useRouter();
  const { show, toastState } = useToast();
  const { confirmSkip } = useOnboardingExit(show);

  return (
    <>
      <AutocorrectScreen
        testID="autocorrect"
        onBack={router.back}
        onSkip={confirmSkip}
        onNext={() => router.push(Routes.onboardingRecord)}
      />
      <Toast {...toastState} />
    </>
  );
}
