/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import * as Linking from "expo-linking";
import React from "react";

import { SettingsFooter } from "./SettingsFooter";

beforeEach(() => {
  jest.clearAllMocks();
  (Linking as any).openURL = jest.fn(async () => undefined);
});

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    nativeApplicationVersion: null,
    nativeBuildVersion: null,
    expoConfig: {
      version: "1.2.3",
      ios: { buildNumber: "42" },
      android: { versionCode: 42 },
    },
  },
}));

jest.mock("../../../ui/icon/Icon", () => ({
  Icon: (props: any) => {
    const { View } = require("react-native");
    const { dynamicTestID: dTID } = require("@/constants");
    return <View testID={dTID.icon(props.name)} />;
  },
}));

jest.mock("../../../ui/divider/Divider", () => ({
  Divider: () => {
    const { View } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return <View testID={TID.Divider} />;
  },
}));

jest.mock("../../../ui/tooltip/Tooltip", () => ({
  Tooltip: () => {
    const { View } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return <View testID={TID.Tooltip} />;
  },
}));

jest.mock("../../../ui/tooltip/useTooltip", () => ({
  useTooltip: () => ({
    show: jest.fn(),
    tooltipState: { visible: false, message: "" },
  }),
}));

describe("SettingsFooter", () => {
  it("renders footer logo icon", () => {
    const { getByTestId } = render(<SettingsFooter />);
    expect(getByTestId("icon-footer_logo")).toBeTruthy();
  });

  it('renders "Follow us" text', () => {
    const { getByText } = render(<SettingsFooter />);
    expect(getByText("followUs")).toBeTruthy();
  });

  it("renders social links (Echos, A1 Lab, JAN3)", () => {
    const { getByText } = render(<SettingsFooter />);
    expect(getByText("Echos")).toBeTruthy();
    expect(getByText("A1 Lab")).toBeTruthy();
    expect(getByText("JAN3")).toBeTruthy();
  });

  it("renders app version text", () => {
    const { getByText } = render(<SettingsFooter />);
    expect(getByText("App Version 1.2.3 (42)")).toBeTruthy();
  });

  it("prefers native binary version/build over expoConfig", () => {
    const Constants = require("expo-constants").default;
    Constants.nativeApplicationVersion = "9.9.9";
    Constants.nativeBuildVersion = "777";
    const { getByText } = render(<SettingsFooter />);
    expect(getByText("App Version 9.9.9 (777)")).toBeTruthy();
    Constants.nativeApplicationVersion = null;
    Constants.nativeBuildVersion = null;
  });

  it("social link press opens X URL", async () => {
    const { getByText } = render(<SettingsFooter />);
    fireEvent.press(getByText("Echos"));
    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith("https://x.com/a1echos");
    });
  });

  it("swallows openURL errors without crashing", async () => {
    (Linking as any).openURL = jest.fn(async () => {
      throw new Error("no handler");
    });
    const { getByText } = render(<SettingsFooter />);
    fireEvent.press(getByText("Echos"));
    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith("https://x.com/a1echos");
    });
  });
});
