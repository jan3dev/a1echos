import { renderHook } from "@testing-library/react-native";
import {
  Animated,
  PanResponder,
  PanResponderCallbacks,
  PanResponderGestureState,
} from "react-native";

import { useSwipeToDismiss } from "./useSwipeToDismiss";

describe("useSwipeToDismiss", () => {
  let config: PanResponderCallbacks;
  const event = {} as never;
  const gesture = (g: Partial<PanResponderGestureState>) =>
    ({ dx: 0, dy: 0, vy: 0, ...g }) as PanResponderGestureState;

  beforeEach(() => {
    const create = PanResponder.create;
    jest.spyOn(PanResponder, "create").mockImplementation((c) => {
      config = c;
      return create(c);
    });
  });

  afterEach(() => jest.restoreAllMocks());

  const valueOf = (v: Animated.Value) =>
    (v as unknown as { __getValue: () => number }).__getValue();

  it("claims touches on the panel itself, and only downward drags from its children", () => {
    renderHook(() => useSwipeToDismiss(true, jest.fn()));
    expect(config.onStartShouldSetPanResponder!(event, gesture({}))).toBe(true);
    const claims = config.onMoveShouldSetPanResponder!;

    expect(claims(event, gesture({ dy: 20 }))).toBe(true);
    expect(claims(event, gesture({ dy: 4 }))).toBe(false);
    expect(claims(event, gesture({ dy: -20 }))).toBe(false);
    expect(claims(event, gesture({ dy: 20, dx: 40 }))).toBe(false);
  });

  it("follows the finger downward and clamps upward drags", () => {
    const { result } = renderHook(() => useSwipeToDismiss(true, jest.fn()));

    config.onPanResponderMove!(event, gesture({ dy: 60 }));
    expect(valueOf(result.current.dragY)).toBe(60);

    config.onPanResponderMove!(event, gesture({ dy: -30 }));
    expect(valueOf(result.current.dragY)).toBe(0);
  });

  it("dismisses past the distance or velocity threshold", () => {
    const onDismiss = jest.fn();
    renderHook(() => useSwipeToDismiss(true, onDismiss));

    config.onPanResponderRelease!(event, gesture({ dy: 80 }));
    config.onPanResponderRelease!(event, gesture({ dy: 30, vy: 1 }));
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it("springs back on a short drag, a cancel, or without onDismiss", () => {
    const spring = jest.spyOn(Animated, "spring");
    const onDismiss = jest.fn();
    const { rerender } = renderHook(
      ({ cb }: { cb?: () => void }) => useSwipeToDismiss(true, cb),
      { initialProps: { cb: onDismiss as (() => void) | undefined } },
    );

    config.onPanResponderRelease!(event, gesture({ dy: 40 }));
    config.onPanResponderTerminate!(event, gesture({}));
    rerender({ cb: undefined });
    config.onPanResponderRelease!(event, gesture({ dy: 300 }));

    expect(onDismiss).not.toHaveBeenCalled();
    expect(spring).toHaveBeenCalledTimes(3);
  });

  it("resets the drag offset when reopened", () => {
    const { result, rerender } = renderHook(
      ({ visible }) => useSwipeToDismiss(visible, jest.fn()),
      { initialProps: { visible: true } },
    );

    config.onPanResponderMove!(event, gesture({ dy: 200 }));
    rerender({ visible: false });
    expect(valueOf(result.current.dragY)).toBe(200);

    rerender({ visible: true });
    expect(valueOf(result.current.dragY)).toBe(0);
  });
});
