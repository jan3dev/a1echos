import { useIsFocused } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

import { type RecordingJumpButton, useSetRecordingJumpButton } from "@/stores";

/**
 * Shows a jump button in the global recording controls while this screen is
 * focused, so it sits above their fade and gets touches on Android.
 */
export function usePublishRecordingJumpButton({
  visible,
  direction,
  placement,
  onPress,
}: RecordingJumpButton) {
  const setButton = useSetRecordingJumpButton();
  const isFocused = useIsFocused();
  // Screens stay mounted under pushed ones: only clear our own button.
  const owner = useRef({}).current;
  // Stable so a new callback identity doesn't rewrite the store.
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const press = useCallback(() => onPressRef.current(), []);

  useEffect(() => {
    if (isFocused) {
      setButton(owner, { visible, direction, placement, onPress: press });
    }
  }, [direction, isFocused, owner, placement, press, setButton, visible]);

  useEffect(() => {
    if (!isFocused) return;
    return () => setButton(owner, null);
  }, [isFocused, owner, setButton]);
}
