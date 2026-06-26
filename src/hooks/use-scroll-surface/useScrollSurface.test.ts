import { act, renderHook } from "@testing-library/react-native";
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";

import { useScrollSurface } from "./useScrollSurface";

const scrollEvent = (
  y: number,
  contentHeight = 1000,
  layoutHeight = 800,
): NativeSyntheticEvent<NativeScrollEvent> =>
  ({
    nativeEvent: {
      contentOffset: { x: 0, y },
      contentSize: { width: 0, height: contentHeight },
      layoutMeasurement: { width: 0, height: layoutHeight },
    },
  }) as unknown as NativeSyntheticEvent<NativeScrollEvent>;

const layoutEvent = (height: number): LayoutChangeEvent =>
  ({
    nativeEvent: { layout: { x: 0, y: 0, width: 0, height } },
  }) as unknown as LayoutChangeEvent;

describe("useScrollSurface", () => {
  it("starts not scrolled and with no content below", () => {
    const { result } = renderHook(() => useScrollSurface());
    expect(result.current.scrolled).toBe(false);
    expect(result.current.contentBelow).toBe(false);
  });

  it("flips scrolled once the offset passes the default threshold (4)", () => {
    const { result } = renderHook(() => useScrollSurface());

    act(() => result.current.onScroll(scrollEvent(4)));
    expect(result.current.scrolled).toBe(false);

    act(() => result.current.onScroll(scrollEvent(5)));
    expect(result.current.scrolled).toBe(true);

    act(() => result.current.onScroll(scrollEvent(0)));
    expect(result.current.scrolled).toBe(false);
  });

  it("honours a custom threshold", () => {
    const { result } = renderHook(() => useScrollSurface(50));

    act(() => result.current.onScroll(scrollEvent(40)));
    expect(result.current.scrolled).toBe(false);

    act(() => result.current.onScroll(scrollEvent(60)));
    expect(result.current.scrolled).toBe(true);
  });

  it("derives contentBelow from layout + content size at the top", () => {
    const { result } = renderHook(() => useScrollSurface());

    act(() => result.current.onLayout(layoutEvent(800)));
    expect(result.current.contentBelow).toBe(false);

    act(() => result.current.onContentSizeChange(0, 1000));
    expect(result.current.contentBelow).toBe(true);

    act(() => result.current.onContentSizeChange(0, 500));
    expect(result.current.contentBelow).toBe(false);
  });

  it("derives contentBelow from a scroll event's sizes", () => {
    const { result } = renderHook(() => useScrollSurface());

    act(() => result.current.onScroll(scrollEvent(10, 1200, 800)));
    expect(result.current.contentBelow).toBe(true);

    act(() => result.current.onScroll(scrollEvent(10, 700, 800)));
    expect(result.current.contentBelow).toBe(false);
  });

  it("clears contentBelow once scrolled to the bottom even if content overflows", () => {
    const { result } = renderHook(() => useScrollSurface());

    // Overflowing list, scrolled to the top: content sits below the fold.
    act(() => result.current.onScroll(scrollEvent(0, 1000, 800)));
    expect(result.current.contentBelow).toBe(true);

    // Scrolled to the very bottom (offset === contentHeight - layoutHeight):
    // nothing is behind the bottom bar anymore.
    act(() => result.current.onScroll(scrollEvent(200, 1000, 800)));
    expect(result.current.contentBelow).toBe(false);
  });

  it("keeps the same handler references across renders", () => {
    const { result, rerender } = renderHook(() => useScrollSurface());
    const first = result.current.onScroll;
    rerender({});
    expect(result.current.onScroll).toBe(first);
  });

  it("reset() clears both flags after the content scrolled away", () => {
    const { result } = renderHook(() => useScrollSurface());

    act(() => result.current.onScroll(scrollEvent(200, 1000, 800)));
    expect(result.current.scrolled).toBe(true);

    act(() => result.current.onScroll(scrollEvent(0, 1000, 800)));
    expect(result.current.contentBelow).toBe(true);

    // List unmounts (loading/error/empty): no scroll event fires, so reset()
    // is what returns the surface to its resting state.
    act(() => result.current.reset());
    expect(result.current.scrolled).toBe(false);
    expect(result.current.contentBelow).toBe(false);
  });

  it("reset() is a no-op when already at rest", () => {
    const { result } = renderHook(() => useScrollSurface());
    act(() => result.current.reset());
    expect(result.current.scrolled).toBe(false);
    expect(result.current.contentBelow).toBe(false);
  });
});
