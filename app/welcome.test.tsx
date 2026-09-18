/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { Routes } from "@/constants";

import Welcome from "./welcome";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require("react-native");
    return <Text testID="redirect">{href}</Text>;
  },
  useRouter: () => ({ push: mockPush }),
}));

const mockHasSeenWelcome = jest.fn(() => false);
jest.mock("@/stores", () => ({
  useHasSeenWelcome: () => mockHasSeenWelcome(),
}));

jest.mock("@/components", () => {
  const { TouchableOpacity, Text } = require("react-native");
  return {
    WelcomeScreen: ({ onGetStarted }: { onGetStarted: () => void }) => (
      <TouchableOpacity testID="get-started" onPress={onGetStarted}>
        <Text>Get Started</Text>
      </TouchableOpacity>
    ),
  };
});

beforeEach(() => {
  mockPush.mockClear();
  mockHasSeenWelcome.mockReturnValue(false);
});

describe("Welcome route", () => {
  it("renders the welcome screen", () => {
    const { getByTestId } = render(<Welcome />);
    expect(getByTestId("get-started")).toBeTruthy();
  });

  it("advances to the allow-microphone step on Get Started", () => {
    const { getByTestId } = render(<Welcome />);
    fireEvent.press(getByTestId("get-started"));
    expect(mockPush).toHaveBeenCalledWith(Routes.onboardingAllowMicrophone);
  });

  it("redirects home when onboarding is already complete", () => {
    mockHasSeenWelcome.mockReturnValue(true);
    const { getByTestId, queryByTestId } = render(<Welcome />);
    expect(queryByTestId("get-started")).toBeNull();
    expect(getByTestId("redirect").props.children).toBe(Routes.home);
  });
});
