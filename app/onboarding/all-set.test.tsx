/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import AllSet from "./all-set";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
}));

const mockFinishOnboarding = jest.fn();
jest.mock("@/hooks", () => ({
  useOnboardingExit: () => ({ finishOnboarding: mockFinishOnboarding }),
}));

jest.mock("@/components", () => {
  const { TouchableOpacity, View } = require("react-native");
  return {
    AllSetScreen: (props: { onBack: () => void; onGetStarted: () => void }) => (
      <View>
        <TouchableOpacity testID="back" onPress={props.onBack} />
        <TouchableOpacity testID="cta" onPress={props.onGetStarted} />
      </View>
    ),
  };
});

describe("AllSet onboarding route", () => {
  it("wires back and get started", () => {
    const { getByTestId } = render(<AllSet />);
    fireEvent.press(getByTestId("back"));
    fireEvent.press(getByTestId("cta"));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockFinishOnboarding).toHaveBeenCalledTimes(1);
  });
});
