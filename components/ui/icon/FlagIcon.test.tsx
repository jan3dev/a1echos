import { render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";

import { FlagIcon } from "./FlagIcon";

const mockLogWarn = jest.fn();
jest.mock("@/utils", () => ({
  ...jest.requireActual("@/utils"),
  logWarn: (...args: unknown[]) => mockLogWarn(...args),
}));

// Mock flagIcons to provide a controlled test flag
jest.mock("./flagIcons", () => ({
  flagIcons: {
    us: jest.fn((props: { width?: number; height?: number }) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { View } = require("react-native");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { TestID: TID } = require("@/constants");
      return (
        <View
          testID={TID.MockFlagSvg}
          style={{ width: props.width, height: props.height }}
        />
      );
    }),
  },
}));

describe("FlagIcon", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders flag icon for known country code", () => {
    const { getByTestId } = render(<FlagIcon name="us" />);
    expect(getByTestId(TestID.MockFlagSvg)).toBeTruthy();
  });

  it("renders empty View for unknown country code", () => {
    const { toJSON } = render(<FlagIcon name="zz_unknown" />);
    const tree = toJSON();
    // FlagIcon returns a <View> with width/height when flag is not found
    expect(tree).not.toBeNull();
    const node = tree as { type: string; props: Record<string, unknown> };
    expect(node.type).toBe("View");
    expect(node.props.style).toEqual(
      expect.objectContaining({ width: 24, height: 24 }),
    );
    expect(mockLogWarn).toHaveBeenCalledWith(
      "Flag icon not found for: zz_unknown",
    );
  });

  it("applies custom size to the flag icon", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { flagIcons } = require("./flagIcons");
    render(<FlagIcon name="us" size={48} />);
    // React passes props as first arg and ref (undefined) as second arg.
    expect(flagIcons.us).toHaveBeenCalledWith(
      expect.objectContaining({ width: 48, height: 48 }),
      undefined,
    );
  });
});
