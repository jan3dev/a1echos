/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";

import MicrophoneTimeoutSettingsScreen from "./microphone-timeout";

// --- Mocks ---
//
// The picker's behaviour (save, rollback, pending state, back-navigation) is
// covered once in OptionPickerScreen.test.tsx. This suite only pins the wiring
// this route is responsible for: which options, labels, title and setter it
// hands the shared picker.

const mockSetMicTimeout = jest.fn();

const {
  mockMakeLoc,
} = require("../../../src/test-utils/mock-localization/mockLocalization");

jest.mock("@/hooks", () => ({
  useLocalization: jest.fn(() => ({ loc: mockMakeLoc() })),
}));

jest.mock("@/stores", () => ({
  KEYBOARD_MIC_TIMEOUT_OPTIONS: [0, 60, 300, 1200, 3600],
  useKeyboardMicTimeout: jest.fn(() => 300),
  useSetKeyboardMicTimeout: jest.fn(() => mockSetMicTimeout),
}));

const mockPickerProps = jest.fn();
jest.mock("@/components", () => ({
  OptionPickerScreen: (props: any) => {
    mockPickerProps(props);
    return null;
  },
}));

describe("MicrophoneTimeoutSettingsScreen", () => {
  beforeEach(() => {
    mockPickerProps.mockClear();
    mockSetMicTimeout.mockClear();
  });

  const propsOf = () => {
    render(<MicrophoneTimeoutSettingsScreen />);
    return mockPickerProps.mock.calls[0][0];
  };

  it("passes the timeout title", () => {
    expect(String(propsOf().title)).toBe("micTimeoutTitle");
  });

  // Forwards the store's constant rather than an inlined copy. The constant's
  // actual values are pinned in settingsStore.test.ts.
  it("forwards the store's options constant", () => {
    const { KEYBOARD_MIC_TIMEOUT_OPTIONS } = require("@/stores");
    expect(propsOf().options).toBe(KEYBOARD_MIC_TIMEOUT_OPTIONS);
  });

  it("passes the persisted selection and the store setter", () => {
    const props = propsOf();
    expect(props.selected).toBe(300);
    expect(props.onSelect).toBe(mockSetMicTimeout);
  });

  it("uses the mic-timeout TestID prefix", () => {
    expect(propsOf().testIDPrefix).toBe(TestID.MicTimeoutOption);
  });

  it("maps each option to its localized label", () => {
    const { labelFor } = propsOf();
    expect(String(labelFor(0))).toBe("micTimeoutOff");
    expect(String(labelFor(60))).toBe("micTimeout1Min");
    expect(String(labelFor(300))).toBe("micTimeout5Min");
    expect(String(labelFor(1200))).toBe("micTimeout20Min");
    expect(String(labelFor(3600))).toBe("micTimeout60Min");
  });
});
