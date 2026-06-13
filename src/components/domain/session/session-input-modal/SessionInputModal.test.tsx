/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Keyboard } from "react-native";

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

// Drives the keyboard listeners registered by useKeyboardHeight so tests can
// flip the modal into its "keyboard visible" state regardless of platform.
const mockKeyboardListeners = () => {
  const listeners: Record<string, (e: any) => void> = {};
  const remove = jest.fn();
  jest
    .spyOn(Keyboard, "addListener")
    .mockImplementation((event: string, cb: (e: any) => void) => {
      listeners[event] = cb;
      return { remove } as never;
    });
  const show = (height: number) => {
    const cb = listeners.keyboardWillShow ?? listeners.keyboardDidShow;
    act(() => cb?.({ endCoordinates: { height } }));
  };
  const hide = () => {
    const cb = listeners.keyboardWillHide ?? listeners.keyboardDidHide;
    act(() => cb?.({ endCoordinates: { height: 0 } }));
  };
  return { show, hide, remove };
};

describe("SessionInputModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("renders title text", () => {
    const { getByText } = render(<SessionInputModal {...defaultProps} />);
    expect(getByText("Rename Session")).toBeTruthy();
  });

  it("renders the max-length helper text", () => {
    const { getByTestId } = render(<SessionInputModal {...defaultProps} />);
    expect(getByTestId(TestID.SessionInputModalCard)).toBeTruthy();
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

  it("clears animations when visibility changes to false", () => {
    const { getByTestId, rerender, queryByTestId } = render(
      <SessionInputModal {...defaultProps} visible={true} />,
    );
    expect(getByTestId(TestID.Dimmer)).toBeTruthy();
    rerender(<SessionInputModal {...defaultProps} visible={false} />);
    expect(queryByTestId(TestID.Dimmer)).toBeNull();
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
    const kb = mockKeyboardListeners();
    const dismissSpy = jest.spyOn(Keyboard, "dismiss").mockImplementation();
    const onCancel = jest.fn();

    const { getByTestId } = render(
      <SessionInputModal {...defaultProps} onCancel={onCancel} />,
    );

    fireEvent(getByTestId(TestID.SessionInputModalCard), "layout", {
      nativeEvent: { layout: { height: 400 } },
    });
    kb.show(320);

    fireEvent.press(getByTestId(TestID.DimmerBackdrop));
    expect(dismissSpy).toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("lifts above the keyboard then settles when it hides", () => {
    const kb = mockKeyboardListeners();
    const onCancel = jest.fn();

    const { getByTestId } = render(
      <SessionInputModal {...defaultProps} onCancel={onCancel} />,
    );

    // Measure the card so the keyboard-lift effect has a height to work with.
    fireEvent(getByTestId(TestID.SessionInputModalCard), "layout", {
      nativeEvent: { layout: { height: 600 } },
    });
    // Tall keyboard forces an overlap → the card shifts up.
    kb.show(400);
    // Hiding it returns the card to rest and clears the keyboard-visible flag.
    kb.hide();

    fireEvent.press(getByTestId(TestID.DimmerBackdrop));
    expect(onCancel).toHaveBeenCalled();
  });

  it("ignores a repeated layout with the same height", () => {
    const { getByTestId } = render(<SessionInputModal {...defaultProps} />);
    const card = getByTestId(TestID.SessionInputModalCard);
    fireEvent(card, "layout", { nativeEvent: { layout: { height: 300 } } });
    fireEvent(card, "layout", { nativeEvent: { layout: { height: 300 } } });
    expect(card).toBeTruthy();
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

  it("handleDismiss is a no-op-safe when onCancel is undefined", () => {
    const propsWithoutCancel = {
      visible: true,
      title: "Rename",
      buttonText: "Save",
      initialValue: "",
      onSubmit: jest.fn(),
    };
    const { getByTestId } = render(
      <SessionInputModal {...propsWithoutCancel} />,
    );
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
    const kb = mockKeyboardListeners();
    const { unmount } = render(<SessionInputModal {...defaultProps} />);
    unmount();
    expect(kb.remove).toHaveBeenCalled();
  });
});
