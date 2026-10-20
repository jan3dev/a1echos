import { useRouter } from "expo-router";
import { useCallback, useEffect } from "react";

import { EchosKeyboardScreen, Toast } from "@/components";
import { useToast } from "@/components/ui/toast/useToast";
import { TestID } from "@/constants";
import { useKeyboardSettingsCheck } from "@/hooks";
import { useMarkKeyboardPromptSeen } from "@/stores";

export default function EchosKeyboardSettingsScreen() {
  const router = useRouter();
  const markSeen = useMarkKeyboardPromptSeen();
  const { show, toastState } = useToast();
  const close = useCallback(() => router.back(), [router]);
  const { goToSettings, checking } = useKeyboardSettingsCheck({
    onAdded: close,
    showToast: show,
  });

  useEffect(() => {
    void markSeen();
  }, [markSeen]);

  return (
    <>
      <EchosKeyboardScreen
        testID={TestID.EchosKeyboardScreen}
        onClose={close}
        onAddKeyboard={goToSettings}
        checking={checking}
      />
      <Toast {...toastState} />
    </>
  );
}
