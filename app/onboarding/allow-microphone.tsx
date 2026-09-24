import { useRouter } from "expo-router";

import { AllowMicrophoneScreen, Toast } from "@/components";
import { useToast } from "@/components/ui/toast/useToast";
import { Routes } from "@/constants";
import { useMicPermission, useOnboardingExit } from "@/hooks";

export default function AllowMicrophone() {
  const router = useRouter();
  const { show, hide, toastState } = useToast();
  const ensureMicPermission = useMicPermission(show, hide);
  const { confirmSkip } = useOnboardingExit(show);

  const handleAllow = async () => {
    if (await ensureMicPermission())
      router.push(Routes.onboardingEnableKeyboard);
  };

  return (
    <>
      <AllowMicrophoneScreen
        testID="allow-microphone"
        onBack={router.back}
        onSkip={confirmSkip}
        onAllow={handleAllow}
      />
      <Toast {...toastState} />
    </>
  );
}
