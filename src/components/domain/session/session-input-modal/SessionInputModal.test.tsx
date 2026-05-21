/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";

import { SessionInputModal } from "./SessionInputModal";

jest.mock("../../../ui/modal/Dimmer", () => ({
  Dimmer: ({ children, visible, onDismiss }: any) => {
    const { View, Pressable } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return visible ? (
      <View testID={TID.Dimmer}>
        <Pressable testID={TID.DimmerBackdrop} onPress={onDismiss} />
        {children}
      </View>
    ) : null;
  },
}));

jest.mock("../../../ui/textfield/TextField", () => ({
  TextField: (props: any) => {
    const { TextInput, Pressable } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return (
      <>
        <TextInput
          testID={TID.TextField}
          value={props.value}
          onChangeText={props.onChangeText}
          maxLength={props.maxLength}
        />
        {props.onClear && (
          <Pressable testID={TID.ClearButton} onPress={props.onClear} />
        )}
      </>
    );
  },
}));

jest.mock("../../../ui/button/Button", () => ({
  Button: {
    primary: (props: any) => {
      const { Pressable, Text } = require("react-native");
      const { TestID: TID } = require("@/constants");
      return (
        <Pressable testID={TID.PrimaryButton} onPress={props.onPress}>
          <Text>{props.text}</Text>
        </Pressable>
      );
    },
  },
}));

const defaultProps = {
  visible: true,
  title: "Rename Session",
  buttonText: "Save",
  initialValue: "",
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
};

describe("SessionInputModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title text", () => {
    const { getByText } = render(<SessionInputModal {...defaultProps} />);
    expect(getByText("Rename Session")).toBeTruthy();
  });

  it("renders primary button with buttonText", () => {
    const { getByText } = render(<SessionInputModal {...defaultProps} />);
    expect(getByText("Save")).toBeTruthy();
  });

  it("submit calls onSubmit with trimmed text", () => {
    const { getByTestId } = render(
      <SessionInputModal {...defaultProps} initialValue="Hello" />,
    );
    const textField = getByTestId(TestID.TextField);
    fireEvent.changeText(textField, "  New Name  ");
    fireEvent.press(getByTestId(TestID.PrimaryButton));
    expect(defaultProps.onSubmit).toHaveBeenCalledWith("New Name");
  });

  it("renders the drag bar grabber", () => {
    const { getByTestId } = render(<SessionInputModal {...defaultProps} />);
    expect(getByTestId(TestID.SessionInputModalGrabber)).toBeTruthy();
  });

  it("validates max length", () => {
    const { getByTestId } = render(<SessionInputModal {...defaultProps} />);
    const textField = getByTestId(TestID.TextField);
    expect(textField.props.maxLength).toBe(30);
  });

  it("does not submit empty text when no initial value", () => {
    const { getByTestId } = render(<SessionInputModal {...defaultProps} />);
    fireEvent.press(getByTestId(TestID.PrimaryButton));
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit whitespace-only text when no initial value", () => {
    const { getByTestId } = render(<SessionInputModal {...defaultProps} />);
    const textField = getByTestId(TestID.TextField);
    fireEvent.changeText(textField, "   ");
    fireEvent.press(getByTestId(TestID.PrimaryButton));
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it("submits empty trimmed text when initialValue is present", () => {
    const { getByTestId } = render(
      <SessionInputModal {...defaultProps} initialValue="Old Name" />,
    );
    const textField = getByTestId(TestID.TextField);
    fireEvent.changeText(textField, "   ");
    fireEvent.press(getByTestId(TestID.PrimaryButton));
    // trimmed is empty but initialValue.length > 0, so submit is called with ''
    expect(defaultProps.onSubmit).toHaveBeenCalledWith("");
  });

  it("text field value updates on change", () => {
    const { getByTestId } = render(<SessionInputModal {...defaultProps} />);
    const textField = getByTestId(TestID.TextField);
    fireEvent.changeText(textField, "Updated");
    expect(textField.props.value).toBe("Updated");
  });

  it("populates initial value in text field", () => {
    const { getByTestId } = render(
      <SessionInputModal {...defaultProps} initialValue="Existing Name" />,
    );
    const textField = getByTestId(TestID.TextField);
    expect(textField.props.value).toBe("Existing Name");
  });

  it("not visible returns null (Dimmer hides content)", () => {
    const { queryByTestId } = render(
      <SessionInputModal {...defaultProps} visible={false} />,
    );
    expect(queryByTestId(TestID.Dimmer)).toBeNull();
  });

  it("renders when visible", () => {
    const { getByTestId } = render(
      <SessionInputModal {...defaultProps} visible={true} />,
    );
    expect(getByTestId(TestID.Dimmer)).toBeTruthy();
  });

  it("submits trimmed text correctly", () => {
    const { getByTestId } = render(
      <SessionInputModal {...defaultProps} initialValue="test" />,
    );
    const textField = getByTestId(TestID.TextField);
    fireEvent.changeText(textField, "  Hello World  ");
    fireEvent.press(getByTestId(TestID.PrimaryButton));
    expect(defaultProps.onSubmit).toHaveBeenCalledWith("Hello World");
  });

  it("resets text when visibility changes to true with new initialValue", () => {
    const { getByTestId, rerender } = render(
      <SessionInputModal {...defaultProps} visible={true} initialValue="Old" />,
    );
    const textField = getByTestId(TestID.TextField);
    fireEvent.changeText(textField, "Modified");
    expect(textField.props.value).toBe("Modified");

    // Re-render as visible with new initialValue resets text
    rerender(
      <SessionInputModal
        {...defaultProps}
        visible={true}
        initialValue="New Value"
      />,
    );
    const updatedField = getByTestId(TestID.TextField);
    expect(updatedField.props.value).toBe("New Value");
  });

  it("does not submit text exceeding max length", () => {
    const longText = "A".repeat(51);
    const { getByTestId } = render(<SessionInputModal {...defaultProps} />);
    const textField = getByTestId(TestID.TextField);
    fireEvent.changeText(textField, longText);
    fireEvent.press(getByTestId(TestID.PrimaryButton));
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it("onCancel is optional and does not crash when undefined", () => {
    const propsWithoutCancel = {
      visible: true,
      title: "Rename",
      buttonText: "Save",
      onSubmit: jest.fn(),
    };
    expect(() => {
      render(<SessionInputModal {...propsWithoutCancel} />);
    }).not.toThrow();
  });

  it("text field shows correct maxLength from AppConstants", () => {
    const { getByTestId } = render(<SessionInputModal {...defaultProps} />);
    const textField = getByTestId(TestID.TextField);
    expect(textField.props.maxLength).toBe(30);
  });

  it("submit button text matches buttonText prop", () => {
    const { getByText } = render(
      <SessionInputModal {...defaultProps} buttonText="Create" />,
    );
    expect(getByText("Create")).toBeTruthy();
  });

  it("handles submit with text at exactly max length", () => {
    const maxLengthText = "A".repeat(30);
    const { getByTestId } = render(
      <SessionInputModal {...defaultProps} initialValue="test" />,
    );
    const textField = getByTestId(TestID.TextField);
    fireEvent.changeText(textField, maxLengthText);
    fireEvent.press(getByTestId(TestID.PrimaryButton));
    expect(defaultProps.onSubmit).toHaveBeenCalledWith(maxLengthText);
  });

  it("dismiss calls onCancel when keyboard is not visible", () => {
    const onCancel = jest.fn();
    const { getByTestId } = render(
      <SessionInputModal {...defaultProps} onCancel={onCancel} />,
    );
    fireEvent.press(getByTestId(TestID.DimmerBackdrop));
    expect(onCancel).toHaveBeenCalled();
  });

  it("dismiss calls Keyboard.dismiss when keyboard is visible", () => {
    const { Keyboard } = require("react-native");
    const onCancel = jest.fn();
    const mockRemove = jest.fn();
    const originalDismiss = Keyboard.dismiss;
    const mockDismiss = jest.fn();
    Keyboard.dismiss = mockDismiss;

    // Capture the keyboard show listener
    let keyboardShowCallback: (() => void) | null = null;
    const originalAddListener = Keyboard.addListener;
    Keyboard.addListener = jest.fn((event: string, callback: () => void) => {
      if (event === "keyboardDidShow") {
        keyboardShowCallback = callback;
      }
      return { remove: mockRemove };
    });

    const { getByTestId } = render(
      <SessionInputModal {...defaultProps} onCancel={onCancel} />,
    );

    // Simulate keyboard showing
    if (keyboardShowCallback) {
      // @ts-expect-error - keyboardShowCallback is a function
      keyboardShowCallback();
    }

    fireEvent.press(getByTestId(TestID.DimmerBackdrop));
    // Should have called dismiss (which we spy on)
    expect(mockDismiss).toHaveBeenCalled();

    Keyboard.addListener = originalAddListener;
    Keyboard.dismiss = originalDismiss;
  });

  it("clear button resets text field to empty", () => {
    const { getByTestId } = render(
      <SessionInputModal {...defaultProps} initialValue="Some text" />,
    );
    const textField = getByTestId(TestID.TextField);
    expect(textField.props.value).toBe("Some text");

    fireEvent.press(getByTestId(TestID.ClearButton));
    const updatedField = getByTestId(TestID.TextField);
    expect(updatedField.props.value).toBe("");
  });

  it("inner pressable stops event propagation", () => {
    const onCancel = jest.fn();
    const { getByTestId } = render(
      <SessionInputModal {...defaultProps} onCancel={onCancel} />,
    );
    const inner = getByTestId(TestID.SessionInputModal);
    fireEvent.press(inner, { stopPropagation: jest.fn() });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("hides keyboard-visible flag when keyboard dismisses", () => {
    const { Keyboard } = require("react-native");
    const onCancel = jest.fn();
    const mockRemove = jest.fn();
    const originalAddListener = Keyboard.addListener;
    const originalDismiss = Keyboard.dismiss;
    const mockDismiss = jest.fn();
    Keyboard.dismiss = mockDismiss;

    let showCb: (() => void) | null = null;
    let hideCb: (() => void) | null = null;
    Keyboard.addListener = jest.fn((event: string, cb: () => void) => {
      if (event === "keyboardDidShow") showCb = cb;
      if (event === "keyboardDidHide") hideCb = cb;
      return { remove: mockRemove };
    });

    const { getByTestId } = render(
      <SessionInputModal {...defaultProps} onCancel={onCancel} />,
    );

    // @ts-expect-error - showCb is captured above
    showCb?.();
    // @ts-expect-error - hideCb is captured above
    hideCb?.();

    // After hide, backdrop press should call onCancel (not Keyboard.dismiss)
    fireEvent.press(getByTestId(TestID.DimmerBackdrop));
    expect(onCancel).toHaveBeenCalled();
    expect(mockDismiss).not.toHaveBeenCalled();

    Keyboard.addListener = originalAddListener;
    Keyboard.dismiss = originalDismiss;
  });

  it("handleDismiss calls onCancel when keyboard is not visible and onCancel is undefined", () => {
    const propsWithoutCancel = {
      visible: true,
      title: "Rename",
      buttonText: "Save",
      initialValue: "",
      onSubmit: jest.fn(),
      // No onCancel
    };
    const { getByTestId } = render(
      <SessionInputModal {...propsWithoutCancel} />,
    );
    // Should not throw when pressing backdrop without onCancel
    expect(() =>
      fireEvent.press(getByTestId(TestID.DimmerBackdrop)),
    ).not.toThrow();
  });

  it("slide animation fires when visibility changes from false to true", () => {
    const { rerender, getByTestId, queryByTestId } = render(
      <SessionInputModal {...defaultProps} visible={false} />,
    );
    expect(queryByTestId(TestID.Dimmer)).toBeNull();

    rerender(<SessionInputModal {...defaultProps} visible={true} />);
    expect(getByTestId(TestID.Dimmer)).toBeTruthy();
  });

  it("keyboard listeners are cleaned up on unmount", () => {
    const { Keyboard } = require("react-native");
    const mockRemove = jest.fn();
    const originalAddListener = Keyboard.addListener;
    Keyboard.addListener = jest.fn(() => ({ remove: mockRemove }));

    const { unmount } = render(<SessionInputModal {...defaultProps} />);
    unmount();

    // Listeners registered and cleanup called
    expect(Keyboard.addListener).toHaveBeenCalled();
    expect(mockRemove).toHaveBeenCalled();

    Keyboard.addListener = originalAddListener;
  });
});
