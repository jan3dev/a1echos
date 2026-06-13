/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";
import React from "react";
import { AppState } from "react-native";

import { TestID } from "@/constants";

import { ThreeWaveLines } from "./ThreeWaveLines";

// Override Skia mock with component-rendering versions
jest.mock("@shopify/react-native-skia", () => ({
  Canvas: ({ children, ...rest }: any) => {
    const { View } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return (
      <View testID={TID.SkiaCanvas} {...rest}>
        {children}
      </View>
    );
  },
  Path: ({ children, ...rest }: any) => {
    const { View } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return (
      <View testID={TID.SkiaPath} {...rest}>
        {children}
      </View>
    );
  },
  BlurMask: () => null,
  Group: ({ children }: any) => {
    const { View } = require("react-native");
    return <View>{children}</View>;
  },
  Mask: ({ children }: any) => {
    const { View } = require("react-native");
    return <View>{children}</View>;
  },
  Rect: () => null,
  LinearGradient: () => null,
  usePathValue: jest.fn(() => ({ current: null })),
  vec: (x: number, y: number) => ({ x, y }),
  Skia: {
    Path: { Make: jest.fn() },
    Color: jest.fn(),
  },
}));

jest.mock("react-native-worklets", () => ({
  scheduleOnUI: jest.fn((fn: any, ...args: any[]) => fn(...args)),
}));

// Mock reanimated's useFrameCallback (not in global mock)
const reanimatedMock = jest.requireMock("react-native-reanimated");
reanimatedMock.useFrameCallback = jest.fn();

// Self-contained @/stores mock - no external variable references
jest.mock("@/stores", () => ({
  useTranscriptionStore: Object.assign(jest.fn(), {
    subscribe: jest.fn(() => jest.fn()),
    getState: jest.fn(() => ({ audioLevel: 0 })),
  }),
}));

describe("ThreeWaveLines", () => {
  beforeEach(() => {
    const { useTranscriptionStore } = require("@/stores");
    useTranscriptionStore.subscribe.mockClear().mockReturnValue(jest.fn());
    useTranscriptionStore.getState
      .mockClear()
      .mockReturnValue({ audioLevel: 0 });
  });

  it("renders without crashing", () => {
    const { toJSON } = render(<ThreeWaveLines />);
    expect(toJSON()).toBeTruthy();
  });

  it("renders Canvas component", () => {
    const { getByTestId } = render(<ThreeWaveLines />);
    expect(getByTestId(TestID.SkiaCanvas)).toBeTruthy();
  });

  it("renders 12 Path elements (3 waves x 4 blur layers)", () => {
    const { getAllByTestId } = render(<ThreeWaveLines />);
    expect(getAllByTestId(TestID.SkiaPath)).toHaveLength(12);
  });

  it("subscribes to transcriptionStore audio level changes", () => {
    const { useTranscriptionStore } = require("@/stores");
    render(<ThreeWaveLines />);
    expect(useTranscriptionStore.subscribe).toHaveBeenCalled();
  });

  it("responds to AppState changes", () => {
    const addEventListenerSpy = jest.spyOn(AppState, "addEventListener");
    render(<ThreeWaveLines />);
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
    addEventListenerSpy.mockRestore();
  });
});
