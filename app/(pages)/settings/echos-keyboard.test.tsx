/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import EchosKeyboardSettingsScreen from "./echos-keyboard";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
}));

const mockMarkSeen = jest.fn();
jest.mock("@/stores", () => ({
  useMarkKeyboardPromptSeen: () => mockMarkSeen,
}));

const mockAddKeyboard = jest.fn();
let mockOnAdded: () => void = () => {};
jest.mock("@/hooks", () => ({
  useKeyboardSettingsCheck: ({ onAdded }: { onAdded: () => void }) => {
    mockOnAdded = onAdded;
    return { goToSettings: mockAddKeyboard, checking: false };
  },
}));

jest.mock("@/components/ui/toast/useToast", () => ({
  useToast: () => ({ show: jest.fn(), toastState: {} }),
}));

jest.mock("@/components", () => {
  const { TouchableOpacity, View } = require("react-native");
  return {
    EchosKeyboardScreen: ({ onClose, onAddKeyboard }: any) => (
      <View>
        <TouchableOpacity testID="close" onPress={onClose} />
        <TouchableOpacity testID="add" onPress={onAddKeyboard} />
      </View>
    ),
    Toast: () => null,
  };
});

describe("Echos Keyboard route", () => {
  it("marks the prompt seen on open", () => {
    render(<EchosKeyboardSettingsScreen />);
    expect(mockMarkSeen).toHaveBeenCalledTimes(1);
  });

  it("closes back to where the user was", () => {
    const { getByTestId } = render(<EchosKeyboardSettingsScreen />);
    fireEvent.press(getByTestId("close"));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("opens Settings and closes once the keyboard is added", () => {
    const { getByTestId } = render(<EchosKeyboardSettingsScreen />);
    fireEvent.press(getByTestId("add"));
    expect(mockAddKeyboard).toHaveBeenCalledTimes(1);
    expect(mockBack).not.toHaveBeenCalled();

    mockOnAdded();
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
