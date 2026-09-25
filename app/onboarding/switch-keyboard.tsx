import { useRouter } from "expo-router";
import { useEffect } from "react";

import { SwitchKeyboardScreen, Toast } from "@/components";
import { useToast } from "@/components/ui/toast/useToast";
import { Routes } from "@/constants";
import { useOnboardingExit } from "@/hooks";
import { readKeyboardShownAt } from "@/utils";

const POLL_INTERVAL_MS = 500;

export default function SwitchKeyboard() {
  const router = useRouter();
  const { show, toastState } = useToast();
  const { confirmSkip } = useOnboardingExit(show);

  // The keyboard stamps a marker each time it appears; one newer than this
  // screen means the user switched to Echos. Replace so Back from the next
  // screen doesn't land here and bounce straight forward again.
  useEffect(() => {
    const mountedAt = Date.now();
    let done = false;
    const timer = setInterval(async () => {
      const shownAt = await readKeyboardShownAt();
      if (done || shownAt === null || shownAt < mountedAt) return;
      done = true;
      clearInterval(timer);
      router.replace(Routes.onboardingDictate);
    }, POLL_INTERVAL_MS);
    return () => {
      done = true;
      clearInterval(timer);
    };
  }, [router]);

  return (
    <>
      <SwitchKeyboardScreen
        testID="switch-keyboard"
        onBack={router.back}
        onSkip={confirmSkip}
      />
      <Toast {...toastState} />
    </>
  );
}
