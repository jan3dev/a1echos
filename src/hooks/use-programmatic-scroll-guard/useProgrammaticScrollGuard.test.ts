import { act, renderHook } from "@testing-library/react-native";

import { useProgrammaticScrollGuard } from "./useProgrammaticScrollGuard";

describe("useProgrammaticScrollGuard", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("is inactive by default", () => {
    const { result } = renderHook(() => useProgrammaticScrollGuard());
    expect(result.current.isActive()).toBe(false);
  });

  it("activates on begin() and deactivates after the duration elapses", () => {
    const { result } = renderHook(() => useProgrammaticScrollGuard(500));

    act(() => {
      result.current.begin();
    });
    expect(result.current.isActive()).toBe(true);

    act(() => {
      jest.advanceTimersByTime(499);
    });
    expect(result.current.isActive()).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.isActive()).toBe(false);
  });

  it("resets the timer when begin() is called again before it elapses", () => {
    const { result } = renderHook(() => useProgrammaticScrollGuard(500));

    act(() => {
      result.current.begin();
      jest.advanceTimersByTime(300);
      result.current.begin();
      jest.advanceTimersByTime(300);
    });
    // Still active because the second begin() restarted the 500ms window at t=300.
    expect(result.current.isActive()).toBe(true);

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current.isActive()).toBe(false);
  });

  it("returns a stable object across renders", () => {
    const { result, rerender } = renderHook(() => useProgrammaticScrollGuard());
    const first = result.current;
    rerender({});
    expect(result.current).toBe(first);
  });

  it("clears the pending timer on unmount", () => {
    const { result, unmount } = renderHook(() =>
      useProgrammaticScrollGuard(500),
    );
    act(() => {
      result.current.begin();
    });
    unmount();
    expect(() => {
      jest.advanceTimersByTime(1000);
    }).not.toThrow();
  });
});
