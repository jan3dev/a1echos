import { act, renderHook } from "@testing-library/react-native";
import { BackHandler } from "react-native";

import { SEARCH_MOTION_MS, useLanguageSearch } from "./useLanguageSearch";

describe("useLanguageSearch", () => {
  let now = 1_000;
  let onBack: (() => boolean) | undefined;
  const remove = jest.fn();

  beforeEach(() => {
    jest.spyOn(Date, "now").mockImplementation(() => now);
    jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_, handler) => {
        onBack = handler as () => boolean;
        return { remove };
      });
  });

  afterEach(() => jest.restoreAllMocks());

  it("ignores taps while the previous toggle animates, then closes and leaves", () => {
    const leave = jest.fn();
    const { result } = renderHook(() => useLanguageSearch());

    act(() => void result.current.open());
    act(() => result.current.setQuery("fr"));
    expect(result.current.close(leave)).toBe(false);
    expect(result.current.searching).toBe(true);

    now += SEARCH_MOTION_MS;
    act(() => void result.current.close(leave));
    expect(result.current).toMatchObject({ searching: false, query: "" });
    expect(leave).not.toHaveBeenCalled();

    now += SEARCH_MOTION_MS;
    act(() => void result.current.close(leave));
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it("closes search on Android back and stops listening once closed", () => {
    const { result } = renderHook(() => useLanguageSearch());
    act(() => void result.current.open());
    now += SEARCH_MOTION_MS;

    let handled = false;
    act(() => {
      handled = onBack!();
    });
    expect(handled).toBe(true);
    expect(result.current.searching).toBe(false);
    expect(remove).toHaveBeenCalled();
  });
});
