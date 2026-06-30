import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";

import { clearKeyboardLaunchMarker, readKeyboardLaunchMarker } from "@/utils";

import { useVoiceSessionHint } from "./useVoiceSessionHint";

const mockShow = jest.fn();
const mockHide = jest.fn();

jest.mock("@/stores", () => ({
  useUIStore: {
    getState: jest.fn(() => ({
      showVoiceSessionHint: mockShow,
      hideVoiceSessionHint: mockHide,
    })),
  },
}));

jest.mock("@/utils", () => ({
  readKeyboardLaunchMarker: jest.fn(),
  clearKeyboardLaunchMarker: jest.fn(),
}));

const mockRead = readKeyboardLaunchMarker as jest.Mock;
const mockClear = clearKeyboardLaunchMarker as jest.Mock;

describe("useVoiceSessionHint", () => {
  let appStateHandler: (state: string) => void;
  let removeSub: jest.Mock;
  let addEventListenerSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    removeSub = jest.fn();
    addEventListenerSpy = jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event: string, handler: unknown) => {
        appStateHandler = handler as (state: string) => void;
        return { remove: removeSub } as never;
      });
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
  });

  it("shows the hint on mount when a fresh marker exists", async () => {
    mockRead.mockResolvedValue({ openedAt: Date.now() });
    renderHook(() => useVoiceSessionHint());
    await act(async () => {});
    expect(mockClear).toHaveBeenCalled();
    expect(mockShow).toHaveBeenCalled();
  });

  it("ignores a stale marker", async () => {
    mockRead.mockResolvedValue({ openedAt: Date.now() - 10000 });
    renderHook(() => useVoiceSessionHint());
    await act(async () => {});
    expect(mockClear).toHaveBeenCalled();
    expect(mockShow).not.toHaveBeenCalled();
  });

  it("ignores a marker timestamped in the future", async () => {
    mockRead.mockResolvedValue({ openedAt: Date.now() + 10000 });
    renderHook(() => useVoiceSessionHint());
    await act(async () => {});
    expect(mockShow).not.toHaveBeenCalled();
  });

  it("does nothing when there is no marker", async () => {
    mockRead.mockResolvedValue(null);
    renderHook(() => useVoiceSessionHint());
    await act(async () => {});
    expect(mockClear).not.toHaveBeenCalled();
    expect(mockShow).not.toHaveBeenCalled();
  });

  it("re-checks the marker shortly after the app becomes active", async () => {
    jest.useFakeTimers();
    // Cold-start read finds nothing; the marker lands a moment later, and only
    // the post-`active` re-check should surface it.
    mockRead.mockResolvedValueOnce(null);
    renderHook(() => useVoiceSessionHint());
    await act(async () => {});
    expect(mockShow).not.toHaveBeenCalled();

    mockRead.mockResolvedValue({ openedAt: Date.now() });
    act(() => {
      appStateHandler("active");
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(mockShow).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("hides the hint when the app leaves the foreground", () => {
    mockRead.mockResolvedValue(null);
    renderHook(() => useVoiceSessionHint());
    act(() => {
      appStateHandler("background");
    });
    expect(mockHide).toHaveBeenCalled();
  });

  it("removes the AppState subscription on unmount", () => {
    mockRead.mockResolvedValue(null);
    const { unmount } = renderHook(() => useVoiceSessionHint());
    unmount();
    expect(removeSub).toHaveBeenCalled();
  });
});
