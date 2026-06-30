/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { Routes } from "@/constants";

import Welcome from "./welcome";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockMarkWelcomeSeen = jest.fn();
jest.mock("@/stores", () => ({
  useMarkWelcomeSeen: () => mockMarkWelcomeSeen,
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
  mockReplace.mockClear();
  mockMarkWelcomeSeen.mockClear();
});

describe("Welcome route", () => {
  it("renders the welcome screen", () => {
    const { getByTestId } = render(<Welcome />);
    expect(getByTestId("get-started")).toBeTruthy();
  });

  it("marks welcome seen and replaces to home on Get Started", () => {
    const { getByTestId } = render(<Welcome />);
    fireEvent.press(getByTestId("get-started"));
    expect(mockMarkWelcomeSeen).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(Routes.home);
  });
});
