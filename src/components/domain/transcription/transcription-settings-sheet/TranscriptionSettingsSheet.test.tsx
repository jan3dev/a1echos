/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { Platform, StyleSheet, Text, TextInput } from "react-native";
import { usePanGesture } from "react-native-gesture-handler";

import { dynamicTestID, TestID } from "@/constants";
import { SEARCH_MOTION_MS } from "@/hooks/use-language-search/useLanguageSearch";
import { TranscriptionMode } from "@/models";

import { TranscriptionSettingsSheet } from "./TranscriptionSettingsSheet";

const mockSetLanguage = jest.fn().mockResolvedValue(undefined);
const mockSetTranscriptionMode = jest.fn().mockResolvedValue(undefined);
const mockShowLargerModelSuggestion = jest.fn();
const mockHasSeenSuggestion = jest.fn(() => true);
const mockSelectedModelId = jest.fn(() => "whisper_tiny");
const mockOmnilingualDownloaded = jest.fn(() => false);
const mockSetModelId = jest.fn().mockResolvedValue(undefined);
const mockShowOmnilingualDownload = jest.fn();

jest.mock("@/stores", () => ({
  useSelectedModelId: () => mockSelectedModelId(),
  useSelectedTranscriptionMode: () => "realtime",
  useSetTranscriptionMode: () => mockSetTranscriptionMode,
  useSelectedLanguage: () => ({ code: "en", name: "English" }),
  useSetLanguage: () => mockSetLanguage,
  useHasSeenLargerModelSuggestion: () => mockHasSeenSuggestion(),
  useShowLargerModelSuggestion: () => mockShowLargerModelSuggestion,
  useIsModelDownloaded: () => mockOmnilingualDownloaded(),
  useSetModelId: () => mockSetModelId,
  useShowOmnilingualDownload: () => mockShowOmnilingualDownload,
}));

jest.mock("@/hooks", () => ({
  useLocalization: () => ({
    loc: new Proxy({}, { get: (_, key) => String(key) }),
  }),
  useKeyboardHeight: () => 0,
  useLanguageSearch: jest.requireActual(
    "@/hooks/use-language-search/useLanguageSearch",
  ).useLanguageSearch,
}));

// Early A to Z, so within the rows the list first renders.
const arabic = { code: "ar", name: "Arabic" };

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
    mockOmnilingualDownloaded.mockReturnValue(false);
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

  it("shows any language without a picker while Omnilingual detects it", () => {
    mockSelectedModelId.mockReturnValue("omnilingual");
    const { getByTestId, getByText } = renderSheet();
    expect(getByText("anyLanguage")).toBeTruthy();
    fireEvent.press(getByTestId(TestID.TranscriptionSettingsLanguage));
    expect(onLanguagePage()).toBe(false);
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
    expect(getByTestId(dynamicTestID.language("ar"))).toBeTruthy();

    fireEvent.press(getByTestId(TestID.TranscriptionSettingsBack));
    expect(onLanguagePage()).toBe(false);
  });

  it("picking a language saves it and returns to the main page", async () => {
    const { getByTestId } = renderSheet();
    fireEvent.press(getByTestId(TestID.TranscriptionSettingsLanguage));
    await act(async () => {
      fireEvent.press(getByTestId(dynamicTestID.language("ar")));
    });
    expect(mockSetLanguage).toHaveBeenCalledWith(
      expect.objectContaining(arabic),
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
      fireEvent.press(getByTestId(dynamicTestID.language("ar")));
      fireEvent.press(getByTestId(dynamicTestID.language("af")));
    });
    expect(mockSetLanguage).toHaveBeenCalledTimes(1);
  });

  it("stays on the language page when saving fails", async () => {
    mockSetLanguage.mockRejectedValueOnce(new Error("disk full"));
    const { getByTestId } = renderSheet();
    fireEvent.press(getByTestId(TestID.TranscriptionSettingsLanguage));
    await act(async () => {
      fireEvent.press(getByTestId(dynamicTestID.language("ar")));
    });
    expect(onLanguagePage()).toBe(true);
  });

  it("dismisses before nudging toward a larger model", async () => {
    mockHasSeenSuggestion.mockReturnValue(false);
    const onDismiss = jest.fn();
    const { getByTestId, UNSAFE_getByType } = renderSheet({ onDismiss });
    fireEvent.press(getByTestId(TestID.TranscriptionSettingsLanguage));
    await act(async () => {
      fireEvent.press(getByTestId(dynamicTestID.language("ar")));
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

  describe("search", () => {
    let now: number;
    beforeEach(() => {
      now = 0;
      jest.spyOn(Date, "now").mockImplementation(() => now);
    });
    afterEach(() => jest.restoreAllMocks());

    const openSearch = () => {
      const utils = renderSheet();
      fireEvent.press(utils.getByTestId(TestID.TranscriptionSettingsLanguage));
      fireEvent.press(utils.getByTestId(TestID.LanguageSearchOpen));
      now += SEARCH_MOTION_MS;
      return utils;
    };

    it("filters the list, with an empty state when nothing matches", () => {
      const { UNSAFE_getByType, getByTestId, queryByTestId } = openSearch();
      const field = UNSAFE_getByType(TextInput);
      fireEvent.changeText(field, "arab");
      expect(getByTestId(dynamicTestID.language("ar"))).toBeTruthy();
      expect(queryByTestId(dynamicTestID.language("en"))).toBeNull();

      fireEvent.changeText(field, "Klingon");
      expect(getByTestId("no-languages-found")).toBeTruthy();
    });

    it("doesn't offer Omnilingual for a language another model covers", () => {
      mockSelectedModelId.mockReturnValue("nemotron_streaming_en");
      const { UNSAFE_getByType, getByTestId, queryByText } = openSearch();
      fireEvent.changeText(UNSAFE_getByType(TextInput), "Japanese");
      expect(queryByText("availableWithOmnilingual")).toBeNull();
      expect(getByTestId("no-languages-found")).toBeTruthy();
    });

    it("offers Omnilingual only when the current model has no match", () => {
      const { UNSAFE_getByType, getByTestId, queryByText, getByText } =
        openSearch();
      const field = UNSAFE_getByType(TextInput);
      fireEvent.changeText(field, "arab");
      expect(queryByText("availableWithOmnilingual")).toBeNull();

      fireEvent.changeText(field, "Cantonese");
      expect(getByText("availableWithOmnilingual")).toBeTruthy();
      expect(getByTestId(dynamicTestID.language("yue"))).toBeTruthy();
    });

    it("dismisses, then offers the Omnilingual download", () => {
      const onDismiss = jest.fn();
      const utils = renderSheet({ onDismiss });
      fireEvent.press(utils.getByTestId(TestID.TranscriptionSettingsLanguage));
      fireEvent.press(utils.getByTestId(TestID.LanguageSearchOpen));
      now += SEARCH_MOTION_MS;
      fireEvent.changeText(utils.UNSAFE_getByType(TextInput), "Cantonese");
      fireEvent.press(utils.getByTestId(dynamicTestID.language("yue")));
      expect(onDismiss).toHaveBeenCalled();

      const { Modal } = require("react-native");
      if (Platform.OS === "ios") {
        expect(mockShowOmnilingualDownload).not.toHaveBeenCalled();
        act(() => utils.UNSAFE_getByType(Modal).props.onDismiss());
      }
      expect(mockShowOmnilingualDownload).toHaveBeenCalled();
      expect(mockSetModelId).not.toHaveBeenCalled();
    });

    it("activates a downloaded Omnilingual and returns to the main page", () => {
      mockOmnilingualDownloaded.mockReturnValue(true);
      const { UNSAFE_getByType, getByTestId } = openSearch();
      fireEvent.changeText(UNSAFE_getByType(TextInput), "Cantonese");
      fireEvent.press(getByTestId(dynamicTestID.language("yue")));
      expect(mockSetModelId).toHaveBeenCalledWith("omnilingual");
      expect(mockShowOmnilingualDownload).not.toHaveBeenCalled();
      expect(onLanguagePage()).toBe(false);
    });

    it("the x takes the magnifier's place and closes search", () => {
      const { getByTestId, queryByTestId, UNSAFE_queryByType } = openSearch();
      expect(queryByTestId(TestID.LanguageSearchOpen)).toBeNull();
      fireEvent.press(getByTestId(TestID.LanguageSearchClose));
      expect(UNSAFE_queryByType(TextInput)).toBeNull();
      expect(getByTestId(TestID.LanguageSearchOpen)).toBeTruthy();
      expect(onLanguagePage()).toBe(true);
    });

    it("ignores the x while the animation runs", () => {
      const { getByTestId, UNSAFE_queryByType } = renderSheet();
      fireEvent.press(getByTestId(TestID.TranscriptionSettingsLanguage));
      fireEvent.press(getByTestId(TestID.LanguageSearchOpen));
      fireEvent.press(getByTestId(TestID.LanguageSearchClose));
      expect(UNSAFE_queryByType(TextInput)).toBeTruthy();
    });

    it("grows the panel through the shared expand height", () => {
      const reanimated = jest.requireMock("react-native-reanimated");
      const { getByTestId } = openSearch();
      const header = getByTestId(TestID.TranscriptionSettingsDragHeader);
      let page = header.parent;
      while (page && !page.props.onLayout) page = page.parent;
      const layout = (height: number) => ({
        nativeEvent: { layout: { height } },
      });
      fireEvent(page!, "layout", layout(400));
      reanimated.withSpring.mockClear();
      fireEvent(page!, "layout", layout(700));
      expect(reanimated.withSpring).toHaveBeenCalledWith(
        700,
        expect.objectContaining({ damping: 24.6 }),
      );
    });

    it("starts resizing on the tap, without waiting for the relayout", () => {
      const reanimated = jest.requireMock("react-native-reanimated");
      const { getByTestId } = renderSheet();
      fireEvent.press(getByTestId(TestID.TranscriptionSettingsLanguage));
      const header = getByTestId(TestID.TranscriptionSettingsDragHeader);
      let page = header.parent;
      while (page && !page.props.onLayout) page = page.parent;
      fireEvent(page!, "layout", { nativeEvent: { layout: { height: 400 } } });

      const spring = expect.objectContaining({ damping: 24.6 });
      reanimated.withSpring.mockClear();
      fireEvent.press(getByTestId(TestID.LanguageSearchOpen));
      expect(reanimated.withSpring).toHaveBeenCalledWith(
        expect.any(Number),
        spring,
      );
      expect(reanimated.withSpring.mock.calls[0][0]).toBeGreaterThan(400);

      now += SEARCH_MOTION_MS;
      reanimated.withSpring.mockClear();
      fireEvent.press(getByTestId(TestID.LanguageSearchClose));
      expect(reanimated.withSpring).toHaveBeenCalledWith(400, spring);
    });

    it("Android back closes search before leaving the page", () => {
      const { UNSAFE_getByType, UNSAFE_queryByType } = openSearch();
      const { Modal } = require("react-native");
      act(() => UNSAFE_getByType(Modal).props.onRequestClose());
      expect(UNSAFE_queryByType(TextInput)).toBeNull();
      expect(onLanguagePage()).toBe(true);
    });
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
