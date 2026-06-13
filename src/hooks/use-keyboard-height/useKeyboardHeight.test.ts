import { act, renderHook } from "@testing-library/react-native";
import { Keyboard, Platform } from "react-native";

import { useKeyboardHeight } from "./useKeyboardHeight";

type Listener = (event: { endCoordinates: { height: number } }) => void;

describe("useKeyboardHeight", () => {
  let listeners: Record<string, Listener>;
  let removeSpy: jest.Mock;
  let addListenerSpy: jest.SpyInstance;
  const originalOS = Platform.OS;

  beforeEach(() => {
    listeners = {};
    removeSpy = jest.fn();
    addListenerSpy = jest
      .spyOn(Keyboard, "addListener")
      .mockImplementation((event: string, cb: Listener) => {
        listeners[event] = cb;
        return { remove: removeSpy } as never;
      });
  });

  afterEach(() => {
    addListenerSpy.mockRestore();
    Platform.OS = originalOS;
  });

  it("starts at 0", () => {
    const { result } = renderHook(() => useKeyboardHeight());
    expect(result.current).toBe(0);
  });

  it("tracks height on the iOS will-show event and resets on will-hide", () => {
    Platform.OS = "ios";
    const { result } = renderHook(() => useKeyboardHeight());

    act(() => {
      listeners.keyboardWillShow({ endCoordinates: { height: 320 } });
    });
    expect(result.current).toBe(320);

    act(() => {
      listeners.keyboardWillHide({ endCoordinates: { height: 0 } });
    });
    expect(result.current).toBe(0);
  });

  it("uses the did-show/did-hide events on Android", () => {
    Platform.OS = "android";
    const { result } = renderHook(() => useKeyboardHeight());

    act(() => {
      listeners.keyboardDidShow({ endCoordinates: { height: 280 } });
    });
    expect(result.current).toBe(280);

    act(() => {
      listeners.keyboardDidHide({ endCoordinates: { height: 0 } });
    });
    expect(result.current).toBe(0);
  });

  it("ignores a repeated identical height", () => {
    Platform.OS = "ios";
    const { result } = renderHook(() => useKeyboardHeight());

    act(() => {
      listeners.keyboardWillShow({ endCoordinates: { height: 300 } });
    });
    act(() => {
      listeners.keyboardWillShow({ endCoordinates: { height: 300 } });
    });
    expect(result.current).toBe(300);
  });

  it("removes its listeners on unmount", () => {
    const { unmount } = renderHook(() => useKeyboardHeight());
    unmount();
    expect(removeSpy).toHaveBeenCalledTimes(2);
  });
});
