import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { EnableKeyboardScreen, Toast } from "@/components";
import { useToast } from "@/components/ui/toast/useToast";
import { Routes } from "@/constants";
import { useLocalization, useOnboardingExit } from "@/hooks";
import { openKeyboardSettings, readKeyboardEnabled } from "@/utils";

export default function EnableKeyboard() {
  const router = useRouter();
  const { resumed } = useLocalSearchParams<{ resumed?: string }>();
  const { loc } = useLocalization();
  const { show, toastState } = useToast();
  const { confirmSkip } = useOnboardingExit(show);
  // "resumed": relaunched here, likely because iOS kills the app when Full
  // Access is toggled. "settings": the user left for Settings and will return.
  const pendingCheck = useRef<"resumed" | "settings" | null>(
    resumed ? "resumed" : null,
  );

  useEffect(() => {
    const check = async () => {
      const source = pendingCheck.current;
      if (!source) return;
      pendingCheck.current = null;
      // null = can't tell (Android, or iOS hiding the keyboard list): don't block.
      const enabled = await readKeyboardEnabled();
      if (enabled !== false) {
        if (source === "settings" || enabled)
          router.push(Routes.onboardingSpokenLanguage);
        return;
      }
      if (source === "settings")
        show({
          title: loc.onboardingKeyboardNotAddedTitle,
          message: loc.onboardingKeyboardNotAddedMessage,
          variant: "warning",
          messageMaxLines: 3,
        });
    };

    void check();
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener("change", (next) => {
      if (previous === "background" && next === "active") void check();
      previous = next;
    });
    return () => subscription.remove();
  }, [router, show, loc]);

  const handleGoToSettings = async () => {
    pendingCheck.current = "settings";
    // Failure is already logged; Skip remains as the way out.
    if (!(await openKeyboardSettings())) pendingCheck.current = null;
  };

  return (
    <>
      <EnableKeyboardScreen
        testID="enable-keyboard"
        onBack={router.back}
        onSkip={confirmSkip}
        onGoToSettings={handleGoToSettings}
      />
      <Toast {...toastState} />
    </>
  );
}
