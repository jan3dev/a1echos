import { act, renderHook } from "@testing-library/react-native";

import { TooltipOptions, useTooltip } from "./useTooltip";

describe("useTooltip", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const makeOptions = (
    overrides?: Partial<TooltipOptions>,
  ): TooltipOptions => ({
    message: "Tooltip message",
    ...overrides,
  });

  it("initializes with visible=false", () => {
    const { result } = renderHook(() => useTooltip());

    expect(result.current.tooltipState.visible).toBe(false);
    expect(result.current.tooltipState.message).toBe("");
  });

  it("show() sets visible=true", () => {
    const { result } = renderHook(() => useTooltip());

    act(() => {
      result.current.show(makeOptions({ message: "Hello world" }));
    });

    expect(result.current.tooltipState.visible).toBe(true);
    expect(result.current.tooltipState.message).toBe("Hello world");
  });

  it("hide() sets visible=false", () => {
    const { result } = renderHook(() => useTooltip());

    act(() => {
      result.current.show(makeOptions());
    });
    expect(result.current.tooltipState.visible).toBe(true);

    act(() => {
      result.current.hide();
    });
    expect(result.current.tooltipState.visible).toBe(false);
  });

  it("auto-dismisses after 4000ms timeout", () => {
    const { result } = renderHook(() => useTooltip());

    act(() => {
      result.current.show(makeOptions());
    });
    expect(result.current.tooltipState.visible).toBe(true);

    // Advance time just short of the default duration
    act(() => {
      jest.advanceTimersByTime(3999);
    });
    expect(result.current.tooltipState.visible).toBe(true);

    // Advance to exactly 4000ms
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.tooltipState.visible).toBe(false);
  });

  it("resets timer on subsequent show() calls", () => {
    const { result } = renderHook(() => useTooltip());

    // First show
    act(() => {
      result.current.show(makeOptions({ message: "First" }));
    });
    expect(result.current.tooltipState.visible).toBe(true);

    // Advance partway through the timeout
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current.tooltipState.visible).toBe(true);

    // Show again -- this should reset the timer
    act(() => {
      result.current.show(makeOptions({ message: "Second" }));
    });
    expect(result.current.tooltipState.visible).toBe(true);
    expect(result.current.tooltipState.message).toBe("Second");

    // Advance 3000ms again -- still within the NEW 4000ms window
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current.tooltipState.visible).toBe(true);

    // Advance the remaining 1000ms -- now the NEW timer expires
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.tooltipState.visible).toBe(false);
  });

  it("does not auto-dismiss when isDismissible is true", () => {
    const { result } = renderHook(() => useTooltip());

    act(() => {
      result.current.show(makeOptions({ isDismissible: true }));
    });
    expect(result.current.tooltipState.visible).toBe(true);

    // Advance well past the default duration
    act(() => {
      jest.advanceTimersByTime(10000);
    });
    expect(result.current.tooltipState.visible).toBe(true);
  });

  it("uses custom duration when provided", () => {
    const { result } = renderHook(() => useTooltip());

    act(() => {
      result.current.show(makeOptions({ duration: 2000 }));
    });
    expect(result.current.tooltipState.visible).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1999);
    });
    expect(result.current.tooltipState.visible).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.tooltipState.visible).toBe(false);
  });

  it("trailing icon tap calls callback and hides tooltip", () => {
    const onTrailingTap = jest.fn();
    const { result } = renderHook(() => useTooltip());

    act(() => {
      result.current.show(
        makeOptions({ onTrailingIconTap: onTrailingTap, isDismissible: true }),
      );
    });
    expect(result.current.tooltipState.visible).toBe(true);

    act(() => {
      result.current.tooltipState.onTrailingIconTap!();
    });

    expect(onTrailingTap).toHaveBeenCalledTimes(1);
    expect(result.current.tooltipState.visible).toBe(false);
  });

  it("onDismiss hides the tooltip", () => {
    const { result } = renderHook(() => useTooltip());

    act(() => {
      result.current.show(makeOptions({ isDismissible: true }));
    });
    expect(result.current.tooltipState.visible).toBe(true);

    act(() => {
      result.current.tooltipState.onDismiss();
    });
    expect(result.current.tooltipState.visible).toBe(false);
  });
});
