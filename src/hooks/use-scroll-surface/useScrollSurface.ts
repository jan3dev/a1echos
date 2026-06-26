import { useCallback, useRef, useState } from "react";
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";

import { AppConstants } from "@/constants";

export interface ScrollSurface {
  /**
   * True once content is scrolled past the threshold under the top edge. Use to
   * drive a top app bar's glass/blur.
   */
  scrolled: boolean;
  /**
   * True when content is scrolled away from the bottom edge — i.e. content sits
   * below the fold, behind a bottom bar. Goes false at the very bottom (nothing
   * behind the bar). The symmetric bottom-edge equivalent of `scrolled`; use for
   * the bottom sub-screen navbar.
   */
  contentBelow: boolean;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onContentSizeChange: (contentWidth: number, contentHeight: number) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  /**
   * Force both flags back to their resting (false) state. Call when the
   * scrollable content unmounts (loading/error/empty), since no scroll event
   * fires to clear stale glass left over from a prior scrolled position.
   */
  reset: () => void;
}

/**
 * Tracks whether a scroll view has content scrolled under its top edge
 * (`scrolled`) or below its bottom edge (`contentBelow`).
 *
 * Wire `onScroll` (+ `scrollEventThrottle={16}`), `onContentSizeChange`, and
 * `onLayout` to a FlatList/ScrollView, then feed `scrolled`/`contentBelow` to
 * the app bars so their glass background fades in only when content is behind
 * the corresponding edge. State updates fire only on transitions, so per-frame
 * scroll events do not re-render.
 */
export function useScrollSurface(
  threshold: number = AppConstants.APP_BAR_SCROLL_BLUR_THRESHOLD,
): ScrollSurface {
  const [scrolled, setScrolled] = useState(false);
  const [contentBelow, setContentBelow] = useState(false);
  const scrolledRef = useRef(false);
  const belowRef = useRef(false);
  const offsetYRef = useRef(0);
  const contentHeightRef = useRef(0);
  const layoutHeightRef = useRef(0);

  const recompute = useCallback(() => {
    const nextScrolled = offsetYRef.current > threshold;
    if (nextScrolled !== scrolledRef.current) {
      scrolledRef.current = nextScrolled;
      setScrolled(nextScrolled);
    }

    const distanceFromBottom =
      contentHeightRef.current - layoutHeightRef.current - offsetYRef.current;
    const nextBelow =
      layoutHeightRef.current > 0 && distanceFromBottom > threshold;
    if (nextBelow !== belowRef.current) {
      belowRef.current = nextBelow;
      setContentBelow(nextBelow);
    }
  }, [threshold]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      offsetYRef.current = contentOffset.y;
      contentHeightRef.current = contentSize.height;
      layoutHeightRef.current = layoutMeasurement.height;
      recompute();
    },
    [recompute],
  );

  const onContentSizeChange = useCallback(
    (_contentWidth: number, contentHeight: number) => {
      contentHeightRef.current = contentHeight;
      recompute();
    },
    [recompute],
  );

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      layoutHeightRef.current = event.nativeEvent.layout.height;
      recompute();
    },
    [recompute],
  );

  const reset = useCallback(() => {
    offsetYRef.current = 0;
    contentHeightRef.current = 0;
    layoutHeightRef.current = 0;
    if (scrolledRef.current) {
      scrolledRef.current = false;
      setScrolled(false);
    }
    if (belowRef.current) {
      belowRef.current = false;
      setContentBelow(false);
    }
  }, []);

  return {
    scrolled,
    contentBelow,
    onScroll,
    onContentSizeChange,
    onLayout,
    reset,
  };
}
