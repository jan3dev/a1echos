import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useIsFocused } from "expo-router";
import { AppState, Platform } from "react-native";

import { useKeyboardSettingsCheck } from "./useKeyboardSettingsCheck";

const mockOpen = jest.fn();
const mockRead = jest.fn();
jest.mock("@/utils", () => ({
  openKeyboardSettings: () => mockOpen(),
  readKeyboardEnabled: () => mockRead(),
}));

jest.mock("../use-localization/useLocalization", () => ({
  useLocalization: () => ({
    loc: {
      onboardingKeyboardNotAddedTitle: "Not Added",
      onboardingKeyboardNotAddedMessage: "Add it",
      onboardingKeyboardNotAddedMessageAndroid: "Turn it on",
    },
  }),
}));

let mockListener: (state: string) => void = () => {};
const mockRemove = jest.fn();
jest.spyOn(AppState, "addEventListener").mockImplementation((_, listener) => {
  mockListener = listener as (state: string) => void;
  return { remove: mockRemove } as any;
});

const returnFromSettings = () =>
  act(async () => {
    mockListener("background");
    mockListener("active");
  });

const setup = (resumed?: boolean) => {
  const onAdded = jest.fn();
  const showToast = jest.fn();
  const hook = renderHook(() =>
    useKeyboardSettingsCheck({ onAdded, showToast, resumed }),
  );
  return { onAdded, showToast, ...hook };
};

describe("useKeyboardSettingsCheck", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOpen.mockResolvedValue(true);
  });

  it("does nothing on mount unless resumed", () => {
    setup();
    expect(mockRead).not.toHaveBeenCalled();
  });

  it("continues on resume only when the keyboard is known to be added", async () => {
    mockRead.mockResolvedValue(true);
    const { onAdded } = setup(true);
    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1));
  });

  it("stays put on resume when it can't tell", async () => {
    mockRead.mockResolvedValue(null);
    const { onAdded, showToast, result } = setup(true);
    expect(result.current.checking).toBe(true);
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(onAdded).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("continues after Settings unless the keyboard is known missing", async () => {
    mockRead.mockResolvedValue(null);
    const { onAdded, result, rerender } = setup();
    expect(result.current.checking).toBe(false);
    await act(() => result.current.goToSettings());
    expect(result.current.checking).toBe(true);
    await returnFromSettings();
    expect(onAdded).toHaveBeenCalledTimes(1);
    // Busy until the screen it navigated from loses focus.
    expect(result.current.checking).toBe(true);
    (useIsFocused as jest.Mock).mockReturnValueOnce(false);
    rerender({});
    expect(result.current.checking).toBe(false);
  });

  it("warns after Settings when the keyboard is still missing", async () => {
    mockRead.mockResolvedValue(false);
    const { onAdded, showToast, result } = setup();
    await act(() => result.current.goToSettings());
    await returnFromSettings();
    expect(onAdded).not.toHaveBeenCalled();
    expect(result.current.checking).toBe(false);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Not Added", variant: "warning" }),
    );
  });

  it("uses the Android copy on Android", async () => {
    const originalOS = Platform.OS;
    Platform.OS = "android";
    try {
      mockRead.mockResolvedValue(false);
      const { showToast, result } = setup();
      await act(() => result.current.goToSettings());
      await returnFromSettings();
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Turn it on" }),
      );
    } finally {
      Platform.OS = originalOS;
    }
  });

  it("skips the check when Settings fails to open", async () => {
    mockOpen.mockResolvedValue(false);
    const { result } = setup();
    await act(() => result.current.goToSettings());
    await returnFromSettings();
    expect(mockRead).not.toHaveBeenCalled();
    expect(result.current.checking).toBe(false);
  });

  it("drops an in-flight check after unmount", async () => {
    let resolve: (value: boolean) => void = () => {};
    mockRead.mockReturnValue(new Promise((r) => (resolve = r)));
    const { onAdded, unmount } = setup(true);
    unmount();
    await act(async () => resolve(true));
    expect(onAdded).not.toHaveBeenCalled();
    expect(mockRemove).toHaveBeenCalled();
  });
});
