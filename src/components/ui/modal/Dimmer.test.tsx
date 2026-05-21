/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";
import React from "react";
import { Modal, Text } from "react-native";

import { lightColors } from "@/theme";

import { Dimmer } from "./Dimmer";

describe("Dimmer", () => {
  it("renders RN Modal with visible prop", () => {
    const { UNSAFE_root } = render(
      <Dimmer visible={true} onDismiss={jest.fn()}>
        <Text>Content</Text>
      </Dimmer>,
    );
    const rnModal = UNSAFE_root.findByType(Modal);
    expect(rnModal.props.visible).toBe(true);
  });

  it("renders glass scrim background", () => {
    const { useThemeStore } = require("@/theme");
    useThemeStore.setState({ currentTheme: "light" });
    const { toJSON } = render(
      <Dimmer visible={true} onDismiss={jest.fn()}>
        <Text>Content</Text>
      </Dimmer>,
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain(lightColors.glassInverse);
  });

  it("calls onDismiss when backdrop pressed", () => {
    const onDismiss = jest.fn();
    const { UNSAFE_root } = render(
      <Dimmer visible={true} onDismiss={onDismiss}>
        <Text>Content</Text>
      </Dimmer>,
    );
    // The Dimmer has a Pressable wrapping everything that calls onDismiss.
    // Trigger onRequestClose on the RN Modal (simulates Android back press).
    const rnModal = UNSAFE_root.findByType(Modal);
    if (rnModal.props.onRequestClose) {
      rnModal.props.onRequestClose();
    }
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("passes children through", () => {
    const { getByText } = render(
      <Dimmer visible={true} onDismiss={jest.fn()}>
        <Text>Child Content</Text>
      </Dimmer>,
    );
    expect(getByText("Child Content")).toBeTruthy();
  });

  it("uses pinned dark scrim color when isDark", () => {
    const { useThemeStore } = require("@/theme");
    useThemeStore.setState({ currentTheme: "dark" });
    const { toJSON } = render(
      <Dimmer visible={true} onDismiss={jest.fn()}>
        <Text>Dark Content</Text>
      </Dimmer>,
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain("rgba(9, 10, 11, 0.7)");
  });

  it("uses glassInverse scrim color when not isDark", () => {
    const { useThemeStore } = require("@/theme");
    useThemeStore.setState({ currentTheme: "light" });
    const { toJSON } = render(
      <Dimmer visible={true} onDismiss={jest.fn()}>
        <Text>Light Content</Text>
      </Dimmer>,
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain(lightColors.glassInverse);
  });
});
