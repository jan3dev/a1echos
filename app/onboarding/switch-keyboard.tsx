import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

import { SwitchKeyboardScreen, Toast } from "@/components";
import { useToast } from "@/components/ui/toast/useToast";
import { Routes } from "@/constants";
import { useOnboardingExit } from "@/hooks";
import {
  readKeyboardSelected,
  readKeyboardShownAt,
  showKeyboardPicker,
} from "@/utils";

const POLL_INTERVAL_MS = 500;

export default function SwitchKeyboard() {
  const router = useRouter();
  const { show, toastState } = useToast();
  const { confirmSkip } = useOnboardingExit(show);

  // iOS: the keyboard stamps a marker each time it appears; one newer than
  // this screen means the user switched to Echos. Android has no keyboard up
  // here, so ask the system instead. Replace so Back from the next screen
  // doesn't land here and bounce straight forward again.
  useEffect(() => {
    const mountedAt = Date.now();
    let done = false;
    const switched = async () => {
      if (Platform.OS === "android") return readKeyboardSelected();
      const shownAt = await readKeyboardShownAt();
      return shownAt !== null && shownAt >= mountedAt;
    };
    const timer = setInterval(async () => {
      const ok = await switched();
      if (done || !ok) return;
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
        onChooseKeyboard={showKeyboardPicker}
      />
      <Toast {...toastState} />
    </>
  );
}
