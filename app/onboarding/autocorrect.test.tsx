/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import Autocorrect from "./autocorrect";

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

const mockConfirmSkip = jest.fn();
jest.mock("@/hooks", () => ({
  useOnboardingExit: () => ({
    confirmSkip: mockConfirmSkip,
  }),
}));

jest.mock("@/components", () => {
  const { TouchableOpacity, View } = require("react-native");
  return {
    AutocorrectScreen: (props: {
      onBack: () => void;
      onSkip: () => void;
      onNext: () => void;
    }) => (
      <View>
        <TouchableOpacity testID="back" onPress={props.onBack} />
        <TouchableOpacity testID="skip" onPress={props.onSkip} />
        <TouchableOpacity testID="next" onPress={props.onNext} />
      </View>
    ),
    Toast: () => null,
  };
});

describe("Autocorrect onboarding route", () => {
  it("wires back, skip and next", () => {
    const { getByTestId } = render(<Autocorrect />);
    fireEvent.press(getByTestId("back"));
    fireEvent.press(getByTestId("skip"));
    fireEvent.press(getByTestId("next"));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockConfirmSkip).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/onboarding/record");
  });
});
