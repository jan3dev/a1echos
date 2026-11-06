import { renderHook } from "@testing-library/react-native";
import { useIsFocused } from "expo-router";

import { useUIStore } from "@/stores";

import { usePublishRecordingJumpButton } from "./usePublishRecordingJumpButton";

const button = (onPress: () => void = jest.fn()) => ({
  visible: true,
  direction: "down" as const,
  placement: "record" as const,
  onPress,
});

describe("usePublishRecordingJumpButton", () => {
  afterEach(() => (useIsFocused as jest.Mock).mockReturnValue(true));

  it("publishes while focused and clears only its own button", () => {
    const homeButton = { ...button(), placement: "aboveControls" as const };
    const sessionButton = button();
    const home = renderHook(() => usePublishRecordingJumpButton(homeButton));
    const session = renderHook(() =>
      usePublishRecordingJumpButton(sessionButton),
    );
    expect(useUIStore.getState().recordingJumpButton!.placement).toBe("record");

    // Home blurring after the session took over must not clear the session's.
    (useIsFocused as jest.Mock).mockReturnValue(false);
    home.rerender({});
    expect(useUIStore.getState().recordingJumpButton!.placement).toBe("record");

    session.unmount();
    expect(useUIStore.getState().recordingJumpButton).toBeNull();

    (useIsFocused as jest.Mock).mockReturnValue(true);
    home.rerender({});
    useUIStore.getState().recordingJumpButton!.onPress();
    expect(homeButton.onPress).toHaveBeenCalledTimes(1);
    home.unmount();
  });

  it("keeps the published button when only the callback changes", () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender, unmount } = renderHook(
      ({ onPress }: { onPress: () => void }) =>
        usePublishRecordingJumpButton(button(onPress)),
      { initialProps: { onPress: first } },
    );
    const published = useUIStore.getState().recordingJumpButton;
    rerender({ onPress: second });
    expect(useUIStore.getState().recordingJumpButton).toBe(published);
    published!.onPress();
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    unmount();
  });
});
