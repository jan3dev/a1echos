import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Tracks the on-screen keyboard height (0 when hidden). Subscribes to the
 * `will` events on iOS for an animation-synced value and the `did` events on
 * Android, where the `will` variants are not emitted.
 */
export const useKeyboardHeight = () => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) => {
      const height = e.endCoordinates.height;
      setKeyboardHeight((prev) => (prev === height ? prev : height));
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return keyboardHeight;
};
