/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";

import LmStrengthSettingsScreen from "./lm-strength";

// --- Mocks ---
//
// The picker's behaviour (save, rollback, pending state, back-navigation) is
// covered once in OptionPickerScreen.test.tsx. This suite only pins the wiring
// this route is responsible for: which options, labels, title and setter it
// hands the shared picker.

const mockSetLmStrength = jest.fn();

const {
  mockMakeLoc,
} = require("../../../src/test-utils/mock-localization/mockLocalization");

jest.mock("@/hooks", () => ({
  useLocalization: jest.fn(() => ({ loc: mockMakeLoc() })),
}));

jest.mock("@/stores", () => ({
  KEYBOARD_LM_STRENGTH_OPTIONS: [0.5, 1.0, 1.5, 2.0],
  useKeyboardLmStrength: jest.fn(() => 1.0),
  useSetKeyboardLmStrength: jest.fn(() => mockSetLmStrength),
}));

const mockPickerProps = jest.fn();
jest.mock("@/components", () => ({
  OptionPickerScreen: (props: any) => {
    mockPickerProps(props);
    return null;
  },
}));

describe("LmStrengthSettingsScreen", () => {
  beforeEach(() => {
    mockPickerProps.mockClear();
    mockSetLmStrength.mockClear();
  });

  const propsOf = () => {
    render(<LmStrengthSettingsScreen />);
    return mockPickerProps.mock.calls[0][0];
  };

  it("passes the strength title", () => {
    expect(String(propsOf().title)).toBe("lmStrengthTitle");
  });

  // Forwards the store's constant rather than an inlined copy. The constant's
  // actual values are pinned in settingsStore.test.ts.
  it("forwards the store's options constant", () => {
    const { KEYBOARD_LM_STRENGTH_OPTIONS } = require("@/stores");
    expect(propsOf().options).toBe(KEYBOARD_LM_STRENGTH_OPTIONS);
  });

  it("passes the persisted selection and the store setter", () => {
    const props = propsOf();
    expect(props.selected).toBe(1.0);
    expect(props.onSelect).toBe(mockSetLmStrength);
  });

  it("uses the LM-strength TestID prefix", () => {
    expect(propsOf().testIDPrefix).toBe(TestID.LmStrengthOption);
  });

  it("maps each strength to its localized label", () => {
    const { labelFor } = propsOf();
    expect(String(labelFor(0.5))).toBe("lmStrengthSubtle");
    expect(String(labelFor(1.0))).toBe("lmStrengthBalanced");
    expect(String(labelFor(1.5))).toBe("lmStrengthStrong");
    expect(String(labelFor(2.0))).toBe("lmStrengthMax");
  });

  // "Subtle" through "Maximum" say nothing on their own, so every option
  // carries a blurb explaining what the setting actually does.
  it("gives every strength an explanatory description", () => {
    const { descriptionFor } = propsOf();
    expect(String(descriptionFor(0.5))).toBe("lmStrengthSubtleExample");
    expect(String(descriptionFor(1.0))).toBe("lmStrengthBalancedExample");
    expect(String(descriptionFor(1.5))).toBe("lmStrengthStrongExample");
    expect(String(descriptionFor(2.0))).toBe("lmStrengthMaxExample");
  });
});
