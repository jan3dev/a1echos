import { act, fireEvent, render } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { ScrollView, StyleSheet } from "react-native";

import { TestID, dynamicTestID } from "@/constants";
import { DEFAULT_TEXT_APPEARANCE } from "@/models";
import { useSettingsStore } from "@/stores";

import TextAppearanceSettingsScreen from "./text-appearance";

/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
}));

jest.mock("@/hooks", () => ({
  useScrollSurface: () => ({ scrolled: false, onScroll: jest.fn() }),
  useLocalization: () => ({
    loc: new Proxy({}, { get: (_, key) => String(key) }),
  }),
}));

jest.mock("@/components", () => {
  const { View, Text, TouchableOpacity } = require("react-native");
  return {
    ...require("../../../src/components/domain/settings/text-appearance/TextAppearanceControls"),
    AppBarBlurTarget: ({ children }: any) => <View>{children}</View>,
    Screen: ({ children }: any) => <View>{children}</View>,
    TopAppBar: () => null,
    Text: ({ children }: any) => <Text>{String(children)}</Text>,
    Toggle: () => null,
    ListItem: ({ testID, onPress }: any) => (
      <TouchableOpacity testID={testID} onPress={onPress} />
    ),
  };
});

const previewStyle = (screen: ReturnType<typeof render>) =>
  StyleSheet.flatten(
    screen.getByText("textAppearancePreview").props.style,
  ) as Record<string, unknown>;

const layoutSlider = (screen: ReturnType<typeof render>) =>
  fireEvent(screen.getByTestId(TestID.TextAppearanceSizeSlider), "layout", {
    nativeEvent: { layout: { width: 240, height: 24, x: 0, y: 0 } },
  });

const touch = (locationX: number) => ({
  nativeEvent: {
    locationX,
    pageX: locationX + 16,
    touches: [],
    changedTouches: [],
  },
  touchHistory: { touchBank: [] },
});

describe("TextAppearanceSettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState({ textAppearance: DEFAULT_TEXT_APPEARANCE });
  });

  it("previews the default appearance", () => {
    const screen = render(<TextAppearanceSettingsScreen />);
    expect(previewStyle(screen)).toMatchObject({
      fontFamily: "Inter",
      fontSize: 16,
    });
  });

  it("selecting a typeface updates the store and the preview", async () => {
    const screen = render(<TextAppearanceSettingsScreen />);
    await act(async () => {
      fireEvent.press(screen.getByTestId(dynamicTestID.fontOption("literata")));
    });
    expect(useSettingsStore.getState().textAppearance.font).toBe("literata");
    expect(previewStyle(screen).fontFamily).toBe("Literata-Regular");
  });

  it("bold toggle switches to the bold font file", async () => {
    const screen = render(<TextAppearanceSettingsScreen />);
    await act(async () => {
      fireEvent.press(screen.getByTestId(TestID.TextAppearanceBoldToggle));
    });
    expect(useSettingsStore.getState().textAppearance.bold).toBe(true);
    expect(previewStyle(screen).fontFamily).toBe("Inter-Bold");
  });

  it("tapping the slider snaps to the nearest tick", async () => {
    const screen = render(<TextAppearanceSettingsScreen />);
    layoutSlider(screen);
    const slider = screen.getByTestId(TestID.TextAppearanceSizeSlider);
    await act(async () => {
      slider.props.onResponderGrant(touch(240));
    });
    expect(useSettingsStore.getState().textAppearance.size).toBe(26);
    expect(previewStyle(screen).fontSize).toBe(26);
  });

  it("drag pauses scrolling, ticks and long-press fire haptics", async () => {
    jest.useFakeTimers();
    const screen = render(<TextAppearanceSettingsScreen />);
    layoutSlider(screen);
    const slider = () => screen.getByTestId(TestID.TextAppearanceSizeSlider);

    await act(async () => {
      slider().props.onResponderGrant(touch(90));
    });
    expect(screen.UNSAFE_getByType(ScrollView).props.scrollEnabled).toBe(false);
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(300));
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      slider().props.onResponderMove(touch(120));
    });
    expect(useSettingsStore.getState().textAppearance.size).toBe(18);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      slider().props.onResponderRelease(touch(120));
    });
    expect(screen.UNSAFE_getByType(ScrollView).props.scrollEnabled).toBe(true);
    jest.useRealTimers();
  });

  it("supports accessibility increment/decrement", async () => {
    const screen = render(<TextAppearanceSettingsScreen />);
    const slider = screen.getByTestId(TestID.TextAppearanceSizeSlider);
    await act(async () => {
      fireEvent(slider, "accessibilityAction", {
        nativeEvent: { actionName: "increment" },
      });
    });
    expect(useSettingsStore.getState().textAppearance.size).toBe(18);
    await act(async () => {
      fireEvent(
        screen.getByTestId(TestID.TextAppearanceSizeSlider),
        "accessibilityAction",
        { nativeEvent: { actionName: "decrement" } },
      );
    });
    expect(useSettingsStore.getState().textAppearance.size).toBe(16);
  });
});
