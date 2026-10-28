import { useIsFocused } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

import { ToastOptions } from "@/components/ui/toast/useToast";
import { openKeyboardSettings, readKeyboardEnabled } from "@/utils";

import { useLocalization } from "../use-localization/useLocalization";

interface Options {
  /** Must be stable: a new identity re-runs the pending check. */
  onAdded: () => void;
  showToast: (options: ToastOptions) => void;
  /**
   * Relaunched mid-flow, likely because iOS kills the app when Full Access is
   * toggled: check once on mount, without warning.
   */
  resumed?: boolean;
}

/**
 * Returns a Go to Settings handler that checks the keyboard on return, and
 * whether that check is still settling (until the screen moves on).
 */
export const useKeyboardSettingsCheck = ({
  onAdded,
  showToast,
  resumed = false,
}: Options) => {
  const { loc } = useLocalization();
  const pendingCheck = useRef<"resumed" | "settings" | null>(
    resumed ? "resumed" : null,
  );
  const [checking, setChecking] = useState(resumed);
  const focused = useIsFocused();

  // onAdded navigates away; stay busy through the transition, not after it.
  useEffect(() => {
    if (!focused) setChecking(false);
  }, [focused]);

  useEffect(() => {
    let active = true;
    const check = async () => {
      const source = pendingCheck.current;
      if (!source) return;
      pendingCheck.current = null;
      // null = can't tell (iOS hiding the keyboard list): don't block.
      const enabled = await readKeyboardEnabled();
      if (!active) return;
      if (enabled !== false && (source === "settings" || enabled)) {
        onAdded();
        return;
      }
      setChecking(false);
      if (source === "settings")
        showToast({
          title: loc.onboardingKeyboardNotAddedTitle,
          message:
            Platform.OS === "android"
              ? loc.onboardingKeyboardNotAddedMessageAndroid
              : loc.onboardingKeyboardNotAddedMessage,
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
    return () => {
      active = false;
      subscription.remove();
    };
  }, [onAdded, showToast, loc]);

  const goToSettings = useCallback(async () => {
    pendingCheck.current = "settings";
    setChecking(true);
    // Failure is already logged; the screen's other exits remain.
    if (!(await openKeyboardSettings())) {
      pendingCheck.current = null;
      setChecking(false);
    }
  }, []);

  return { goToSettings, checking };
};
