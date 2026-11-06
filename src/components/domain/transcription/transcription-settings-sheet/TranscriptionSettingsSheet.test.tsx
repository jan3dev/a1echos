/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { Platform, StyleSheet, Text } from "react-native";
import { usePanGesture } from "react-native-gesture-handler";

import { dynamicTestID, TestID } from "@/constants";
import { TranscriptionMode } from "@/models";

import { TranscriptionSettingsSheet } from "./TranscriptionSettingsSheet";

const mockSetLanguage = jest.fn().mockResolvedValue(undefined);
const mockSetTranscriptionMode = jest.fn().mockResolvedValue(undefined);
const mockShowLargerModelSuggestion = jest.fn();
const mockHasSeenSuggestion = jest.fn(() => true);
const mockSelectedModelId = jest.fn(() => "whisper_tiny");

jest.mock("@/stores", () => ({
  useSelectedModelId: () => mockSelectedModelId(),
  useSelectedTranscriptionMode: () => "realtime",
  useSetTranscriptionMode: () => mockSetTranscriptionMode,
  useSelectedLanguage: () => ({ code: "en", name: "English" }),
  useSetLanguage: () => mockSetLanguage,
  useHasSeenLargerModelSuggestion: () => mockHasSeenSuggestion(),
  useShowLargerModelSuggestion: () => mockShowLargerModelSuggestion,
}));

jest.mock("@/hooks", () => ({
  useLocalization: () => ({
    loc: new Proxy({}, { get: (_, key) => String(key) }),
  }),
}));

const spanish = { code: "es", name: "Spanish" };

// Each render builds the sheet's, the footer's, then the language header's pan.
const lastPans = () => (usePanGesture as jest.Mock).mock.calls.slice(-3);
const enabledPans = () => {
  const [[main], , [header]] = lastPans();
  return { main: main.enabled, header: header.enabled };
};
const onLanguagePage = () => enabledPans().header;

const renderSheet = (props = {}) =>
  render(
    <TranscriptionSettingsSheet
      visible
      onDismiss={jest.fn()}
      footer={<Text>footer</Text>}
      {...props}
    />,
  );

describe("TranscriptionSettingsSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasSeenSuggestion.mockReturnValue(true);
    mockSelectedModelId.mockReturnValue("whisper_tiny");
  });

  it("renders mode, language row and footer", () => {
    mockSelectedModelId.mockReturnValue("nemo_parakeet_v3");
    const { getByText, getByTestId, toJSON } = renderSheet();
    expect(getByText("transcriptionModeTitle")).toBeTruthy();
    expect(getByText("realtime")).toBeTruthy();
    expect(getByText("highAccuracy")).toBeTruthy();
    const tree = JSON.stringify(toJSON());
    expect(tree.indexOf('"highAccuracy"')).toBeLessThan(
      tree.indexOf('"realtime"'),
    );
    expect(getByTestId(TestID.TranscriptionSettingsLanguage)).toBeTruthy();
    expect(getByText("footer")).toBeTruthy();
  });

  it("drags from the whole panel, but only the header on the language page", () => {
    const { getByTestId } = renderSheet();
    expect(enabledPans()).toEqual({ main: true, header: false });

    fireEvent.press(getByTestId(TestID.TranscriptionSettingsLanguage));
    expect(enabledPans()).toEqual({ main: false, header: true });
  });

  it("dragging it closed dismisses", () => {
    const onDismiss = jest.fn();
    renderSheet({ onDismiss });
    const [pan] = lastPans()[0];
    act(() => {
      pan.onActivate({ translationY: 0 });
      pan.onDeactivate({ velocityY: 1000, canceled: false });
    });
    expect(onDismiss).toHaveBeenCalled();
  });

  it("offers only file mode for Whisper", () => {
    const { getByText, queryByText } = renderSheet();
    expect(getByText("highAccuracyOnly")).toBeTruthy();
    expect(queryByText("realtime")).toBeNull();
  });

  it("selecting a mode saves it", async () => {
    mockSelectedModelId.mockReturnValue("nemo_parakeet_v3");
    const { getByText } = renderSheet();
    await act(async () => {
      fireEvent.press(getByText("highAccuracy"));
    });
    expect(mockSetTranscriptionMode).toHaveBeenCalledWith(
      TranscriptionMode.FILE,
    );
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it("re-selecting the current mode gives no haptic", () => {
    mockSelectedModelId.mockReturnValue("nemo_parakeet_v3");
    const { getByText } = renderSheet();
    fireEvent.press(getByText("realtime"));
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });

  it("swallows mode save failures (the store logs them)", async () => {
    mockSetTranscriptionMode.mockRejectedValueOnce(new Error("disk full"));
    mockSelectedModelId.mockReturnValue("nemo_parakeet_v3");
    const { getByText } = renderSheet();
    await act(async () => {
      fireEvent.press(getByText("highAccuracy"));
    });
    expect(getByText("footer")).toBeTruthy();
  });

  it("language row opens the language page, back returns", () => {
    const { getByTestId } = renderSheet();
    fireEvent.press(getByTestId(TestID.TranscriptionSettingsLanguage));
    expect(onLanguagePage()).toBe(true);
    expect(getByTestId(dynamicTestID.language("es"))).toBeTruthy();

    fireEvent.press(getByTestId(TestID.TranscriptionSettingsBack));
    expect(onLanguagePage()).toBe(false);
  });

  it("picking a language saves it and returns to the main page", async () => {
    const { getByTestId } = renderSheet();
    fireEvent.press(getByTestId(TestID.TranscriptionSettingsLanguage));
    await act(async () => {
      fireEvent.press(getByTestId(dynamicTestID.language("es")));
    });
    expect(mockSetLanguage).toHaveBeenCalledWith(
      expect.objectContaining(spanish),
    );
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(onLanguagePage()).toBe(false);
  });

  it("re-picking the current language returns without saving", () => {
    const { getByTestId } = renderSheet();
    fireEvent.press(getByTestId(TestID.TranscriptionSettingsLanguage));
    fireEvent.press(getByTestId(dynamicTestID.language("en")));
    expect(mockSetLanguage).not.toHaveBeenCalled();
    expect(onLanguagePage()).toBe(false);
  });

  it("ignores taps while a language save is in flight", async () => {
    const { getByTestId } = renderSheet();
    fireEvent.press(getByTestId(TestID.TranscriptionSettingsLanguage));
    await act(async () => {
      fireEvent.press(getByTestId(dynamicTestID.language("es")));
      fireEvent.press(getByTestId(dynamicTestID.language("fr")));
    });
    expect(mockSetLanguage).toHaveBeenCalledTimes(1);
  });

  it("stays on the language page when saving fails", async () => {
    mockSetLanguage.mockRejectedValueOnce(new Error("disk full"));
    const { getByTestId } = renderSheet();
    fireEvent.press(getByTestId(TestID.TranscriptionSettingsLanguage));
    await act(async () => {
      fireEvent.press(getByTestId(dynamicTestID.language("es")));
    });
    expect(onLanguagePage()).toBe(true);
  });

  it("dismisses before nudging toward a larger model", async () => {
    mockHasSeenSuggestion.mockReturnValue(false);
    const onDismiss = jest.fn();
    const { getByTestId, UNSAFE_getByType } = renderSheet({ onDismiss });
    fireEvent.press(getByTestId(TestID.TranscriptionSettingsLanguage));
    await act(async () => {
      fireEvent.press(getByTestId(dynamicTestID.language("es")));
    });
    expect(onDismiss).toHaveBeenCalled();

    const { Modal } = require("react-native");
    if (Platform.OS === "ios") {
      expect(mockShowLargerModelSuggestion).not.toHaveBeenCalled();
      act(() => UNSAFE_getByType(Modal).props.onDismiss());
    }
    expect(mockShowLargerModelSuggestion).toHaveBeenCalled();
  });

  it("hands the footer off around the fade and closes after it", () => {
    jest.useFakeTimers();
    const { Modal } = require("react-native");
    const onFooterShownChange = jest.fn();
    const { rerender, UNSAFE_getByType } = renderSheet({
      onFooterShownChange,
    });
    act(() => UNSAFE_getByType(Modal).props.onShow());
    expect(onFooterShownChange).toHaveBeenLastCalledWith(true);

    rerender(
      <TranscriptionSettingsSheet
        visible={false}
        onDismiss={jest.fn()}
        footer={<Text>footer</Text>}
        onFooterShownChange={onFooterShownChange}
      />,
    );
    expect(UNSAFE_getByType(Modal).props.visible).toBe(true);
    expect(onFooterShownChange).toHaveBeenLastCalledWith(true);
    act(() => jest.runAllTimers());
    expect(onFooterShownChange).toHaveBeenLastCalledWith(false);
    expect(UNSAFE_getByType(Modal).props.visible).toBe(true);
    act(() => jest.runAllTimers());
    expect(UNSAFE_getByType(Modal).props.visible).toBe(false);
    jest.useRealTimers();
  });

  it("on Android, keeps the global controls unblurred under the copy until it has drawn", () => {
    jest.useFakeTimers();
    const original = Platform.OS;
    Platform.OS = "android";
    const { Modal } = require("react-native");
    const { DimmerBackdrop } = require("../../../ui/modal/Dimmer");
    const onFooterShownChange = jest.fn();
    const { UNSAFE_getByType } = renderSheet({ onFooterShownChange });
    act(() => UNSAFE_getByType(Modal).props.onShow());
    expect(onFooterShownChange).not.toHaveBeenCalled();
    expect(UNSAFE_getByType(DimmerBackdrop).props.blurred).toBe(false);

    act(() => jest.advanceTimersByTime(150));
    expect(onFooterShownChange).toHaveBeenCalledWith(true);
    expect(UNSAFE_getByType(DimmerBackdrop).props.blurred).toBe(true);
    Platform.OS = original;
    jest.useRealTimers();
  });

  it("on Android, a release before the hand-off leaves the global controls shown", () => {
    jest.useFakeTimers();
    const original = Platform.OS;
    Platform.OS = "android";
    const { Modal } = require("react-native");
    const onFooterShownChange = jest.fn();
    const { UNSAFE_getByType, rerender } = renderSheet({ onFooterShownChange });
    act(() => UNSAFE_getByType(Modal).props.onShow());
    rerender(
      <TranscriptionSettingsSheet
        visible={false}
        onDismiss={jest.fn()}
        footer={<Text>footer</Text>}
        onFooterShownChange={onFooterShownChange}
      />,
    );
    act(() => jest.advanceTimersByTime(150));
    expect(onFooterShownChange).not.toHaveBeenCalledWith(true);
    Platform.OS = original;
    jest.useRealTimers();
  });

  it("places the footer copy and the grabber from the top, over the global controls", () => {
    const { getByText, UNSAFE_getAllByType, UNSAFE_root } = renderSheet({
      footerTop: 700,
      grabberTop: 686,
    });
    const { GestureHandlerRootView } = jest.requireMock(
      "react-native-gesture-handler",
    );
    const { Dimensions } = require("react-native");
    // A Modal window that ends above the navigation bar changes nothing.
    act(() =>
      UNSAFE_getAllByType(GestureHandlerRootView)[0].props.onLayout({
        nativeEvent: {
          layout: { height: Dimensions.get("window").height - 48 },
        },
      }),
    );
    let footer = getByText("footer").parent;
    while (footer && StyleSheet.flatten(footer.props.style)?.top === undefined)
      footer = footer.parent;
    expect(StyleSheet.flatten(footer!.props.style).top).toBe(700);
    const tops = UNSAFE_root.findAll(
      (n) => StyleSheet.flatten(n.props.style)?.top === 686,
    );
    expect(tops.length).toBeGreaterThan(0);
  });

  it("stays mounted until the panel is back at rest", () => {
    jest.useFakeTimers();
    const { Modal } = require("react-native");
    const { useAnimatedReaction } = jest.requireMock("react-native-reanimated");
    const { rerender, UNSAFE_getByType } = renderSheet();
    // Per render: the at-rest reaction, then the settled-open one.
    const onRest = useAnimatedReaction.mock.calls.at(-2)[1];
    act(() => onRest(false, true));

    rerender(
      <TranscriptionSettingsSheet
        visible={false}
        onDismiss={jest.fn()}
        footer={<Text>footer</Text>}
      />,
    );
    act(() => jest.runAllTimers());
    act(() => jest.runAllTimers());
    expect(UNSAFE_getByType(Modal).props.visible).toBe(true);

    act(() => onRest(true, false));
    act(() => jest.runAllTimers());
    expect(UNSAFE_getByType(Modal).props.visible).toBe(false);
    jest.useRealTimers();
  });

  it("snapshots the content only once it rests open", () => {
    jest.useFakeTimers();
    const { Modal } = require("react-native");
    const { useAnimatedReaction } = jest.requireMock("react-native-reanimated");
    const { makeImageFromView } = jest.requireMock(
      "@shopify/react-native-skia",
    );
    const { UNSAFE_getByType } = renderSheet();
    act(() => UNSAFE_getByType(Modal).props.onShow());
    act(() => jest.runAllTimers());
    expect(makeImageFromView).not.toHaveBeenCalled();

    makeImageFromView.mockRejectedValueOnce(new Error("blank"));
    const onSettled = useAnimatedReaction.mock.calls.at(-1)[1];
    act(() => onSettled(true, false));
    act(() => jest.runAllTimers());
    expect(makeImageFromView).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("measures both pages and expands once the language list has laid out", () => {
    const reanimated = jest.requireMock("react-native-reanimated");
    reanimated.useAnimatedStyle.mockImplementation((fn: () => object) => fn());
    reanimated.useAnimatedReaction.mockImplementation((fn: () => unknown) =>
      fn(),
    );
    const { getByTestId } = renderSheet();
    const layout = (height: number) => ({
      nativeEvent: { layout: { height } },
    });
    const page = (testID: string) => {
      let node = getByTestId(testID).parent;
      while (node && !node.props.onLayout) node = node.parent;
      return node!;
    };
    fireEvent(
      page(TestID.TranscriptionSettingsLanguage),
      "layout",
      layout(300),
    );

    const expandSpring = [1, expect.objectContaining({ damping: 24.6 })];
    reanimated.withSpring.mockClear();
    fireEvent.press(getByTestId(TestID.TranscriptionSettingsLanguage));
    expect(reanimated.withSpring).not.toHaveBeenCalledWith(...expandSpring);
    fireEvent(
      page(TestID.TranscriptionSettingsDragHeader),
      "layout",
      layout(500),
    );
    expect(reanimated.withSpring).toHaveBeenCalledWith(...expandSpring);

    fireEvent.press(getByTestId(TestID.TranscriptionSettingsBack));
    reanimated.withSpring.mockClear();
    fireEvent.press(getByTestId(TestID.TranscriptionSettingsLanguage));
    expect(reanimated.withSpring).toHaveBeenCalledWith(...expandSpring);

    reanimated.useAnimatedStyle.mockImplementation(() => ({}));
    reanimated.useAnimatedReaction.mockImplementation(() => undefined);
  });

  it("back button on the language page returns instead of closing", () => {
    const onDismiss = jest.fn();
    const { getByTestId, UNSAFE_getByType } = renderSheet({ onDismiss });
    const { Modal } = require("react-native");
    fireEvent.press(getByTestId(TestID.TranscriptionSettingsLanguage));
    act(() => UNSAFE_getByType(Modal).props.onRequestClose());
    expect(onDismiss).not.toHaveBeenCalled();
    expect(onLanguagePage()).toBe(false);

    act(() => UNSAFE_getByType(Modal).props.onRequestClose());
    expect(onDismiss).toHaveBeenCalled();
  });
});
