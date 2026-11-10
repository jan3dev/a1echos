import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Keyboard } from "react-native";

/** Fade of the search field and the title or intro it swaps with. */
export const SEARCH_FADE_MS = 200;
/** Covers the field fade and the keyboard/panel motion it starts. */
export const SEARCH_MOTION_MS = 400;
/** FlatList windowSize for language lists: the default (21 screens) renders
 *  all ~100 languages in batches, blocking the JS thread on Android. */
export const LANGUAGE_LIST_WINDOW = 5;

/** Open state and query of a language picker's search. Taps that land while
 *  the previous open or close still animates are ignored. Android back
 *  closes search before leaving the screen. */
export const useLanguageSearch = () => {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const busyUntilRef = useRef(0);

  const reset = useCallback(() => {
    busyUntilRef.current = 0;
    setSearching(false);
    setQuery("");
  }, []);

  const toggle = useCallback((next: boolean) => {
    busyUntilRef.current = Date.now() + SEARCH_MOTION_MS;
    setSearching(next);
    if (!next) {
      setQuery("");
      Keyboard.dismiss();
    }
  }, []);

  /** Closes search, or calls `leave` when it's already closed. Returns
   *  whether search closed. */
  const close = useCallback(
    (leave?: () => void) => {
      if (Date.now() < busyUntilRef.current) return false;
      if (searching) {
        toggle(false);
        return true;
      }
      leave?.();
      return false;
    },
    [searching, toggle],
  );

  useEffect(() => {
    if (!searching) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [searching, close]);

  return {
    searching,
    query,
    setQuery,
    /** Returns whether search opened. */
    open: () => {
      if (Date.now() < busyUntilRef.current || searching) return false;
      toggle(true);
      return true;
    },
    close,
    /** Closes search at once, e.g. when the picker itself goes away. */
    reset,
  };
};
