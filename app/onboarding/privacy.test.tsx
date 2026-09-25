/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import Privacy from "./privacy";

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

jest.mock("@/components", () => {
  const { TouchableOpacity, View } = require("react-native");
  return {
    PrivacyScreen: (props: { onBack: () => void; onNext: () => void }) => (
      <View>
        <TouchableOpacity testID="back" onPress={props.onBack} />
        <TouchableOpacity testID="next" onPress={props.onNext} />
      </View>
    ),
  };
});

describe("Privacy onboarding route", () => {
  it("wires back and next", () => {
    const { getByTestId } = render(<Privacy />);
    fireEvent.press(getByTestId("back"));
    fireEvent.press(getByTestId("next"));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/onboarding/all-set");
  });
});
