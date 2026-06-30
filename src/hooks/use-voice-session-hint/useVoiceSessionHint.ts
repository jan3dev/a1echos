import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import { useUIStore } from "@/stores";
import { clearKeyboardLaunchMarker, readKeyboardLaunchMarker } from "@/utils";

/**
 * How recent a launch marker must be to act on it. The marker is written when
 * the keyboard opens the app; anything older is a stale file (e.g. a crash
 * before it was cleared) and is ignored rather than surfacing a confusing hint.
 */
const MARKER_FRESHNESS_MS = 5000;

/**
 * After the native deep-link handler writes the marker on a warm start, the
 * `active` AppState event can fire a hair before the write lands. Re-checking
 * after a short delay closes that race without polling.
 */
const WARM_START_RECHECK_MS = 250;

/**
 * Shows the "swipe back to your app" hint when Echos is opened from the iOS
 * keyboard. iOS can't return the user automatically, so the keyboard opens the
 * app (to arm the hot mic) and the native side drops a launch marker; this hook
 * reads it on foreground and raises the hint sheet. The hint is cleared when the
 * app leaves the foreground (the user swiped back) so it never lingers stale.
 */
export const useVoiceSessionHint = (): void => {
  useEffect(() => {
    // The marker is only ever written by the iOS deep-link handler, so there is
    // nothing to read on Android — skip the listener and its per-foreground I/O.
    if (Platform.OS !== "ios") return;

    let cancelled = false;
    let recheckTimer: ReturnType<typeof setTimeout> | undefined;

    const checkMarker = async (): Promise<void> => {
      const marker = await readKeyboardLaunchMarker();
      if (cancelled || !marker) return;
      clearKeyboardLaunchMarker();
      const age = Date.now() - marker.openedAt;
      if (age >= 0 && age < MARKER_FRESHNESS_MS) {
        useUIStore.getState().showVoiceSessionHint();
      }
    };

    // Cold start: the native handler wrote the marker before JS mounted.
    void checkMarker();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        recheckTimer = setTimeout(
          () => void checkMarker(),
          WARM_START_RECHECK_MS,
        );
      } else {
        // The user swiped back to the host app — drop the now-irrelevant hint.
        useUIStore.getState().hideVoiceSessionHint();
      }
    });

    return () => {
      cancelled = true;
      if (recheckTimer) clearTimeout(recheckTimer);
      subscription.remove();
    };
  }, []);
};
