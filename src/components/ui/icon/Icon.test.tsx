/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";
import React from "react";
import { I18nManager, StyleSheet } from "react-native";

import { TestID } from "@/constants";

import { Icon } from "./Icon";

const mockLogWarn = jest.fn();
jest.mock("@/utils", () => ({
  ...jest.requireActual("@/utils"),
  logWarn: (...args: unknown[]) => mockLogWarn(...args),
}));

// Mock iconMap to provide controlled test icons
jest.mock("./iconMap", () => {
  const mockSvg = (props: { width?: number; height?: number }) => {
    const { View } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return (
      <View
        testID={TID.MockSvg}
        style={{ width: props.width, height: props.height }}
      />
    );
  };
  return {
    iconMap: {
      check: jest.fn(mockSvg),
      chevron_right: jest.fn(mockSvg),
      settings: jest.fn(mockSvg),
    },
  };
});

describe("Icon", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders icon from iconMap for a known icon name", () => {
    const { getByTestId } = render(<Icon name={"check" as any} />);
    expect(getByTestId(TestID.MockSvg)).toBeTruthy();
  });

  it("returns null for unknown icon name", () => {
    const { toJSON } = render(<Icon name={"nonexistent_icon_xyz" as any} />);
    expect(toJSON()).toBeNull();
  });

  it("logs warning for unknown icon name", () => {
    render(<Icon name={"nonexistent_icon_xyz" as any} />);
    expect(mockLogWarn).toHaveBeenCalledWith(
      "Icon not found: nonexistent_icon_xyz",
    );
  });

  describe("in RTL", () => {
    beforeEach(() => {
      jest.replaceProperty(I18nManager, "isRTL", true);
    });
    afterEach(() => jest.restoreAllMocks());

    const transformOf = (name: string) => {
      const { toJSON } = render(<Icon name={name as any} />);
      return StyleSheet.flatten((toJSON() as any).props.style).transform;
    };

    it("mirrors directional icons", () => {
      expect(transformOf("chevron_right")).toEqual([{ scaleX: -1 }]);
    });

    it("leaves other icons as drawn", () => {
      expect(transformOf("check")).toBeUndefined();
    });
  });

  it("applies custom size and color to the icon", () => {
    const { iconMap } = require("./iconMap");
    render(<Icon name={"settings" as any} size={32} color="#FF0000" />);
    // The IconComponent (iconMap.settings) should have been called with
    // the custom size and color props.
    // React passes props as first arg and ref (undefined) as second arg.
    expect(iconMap.settings).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 32,
        height: 32,
        color: "#FF0000",
      }),
      undefined,
    );
  });
});
