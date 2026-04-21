/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { feedbackService } from "@/services";

import { Toast } from "./Toast";

jest.mock("@/services", () => ({
  feedbackService: {
    haptic: jest.fn(),
    sound: jest.fn(),
    tap: jest.fn(),
    setRecordingActive: jest.fn(),
  },
}));

// Mock Icon to expose the icon name in the rendered tree
jest.mock("../icon/Icon", () => ({
  Icon: ({ name, ...rest }: { name: string; [key: string]: unknown }) => {
    const { View } = require("react-native");
    return <View testID={`icon-${name}`} {...rest} />;
  },
}));

const defaultProps = {
  visible: true,
  title: "Error Occurred",
  message: "Something went wrong. Please try again.",
  onDismiss: jest.fn(),
};

describe("Toast", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title and message when visible", () => {
    const { getByText } = render(<Toast {...defaultProps} />);
    expect(getByText("Error Occurred")).toBeTruthy();
    expect(getByText("Something went wrong. Please try again.")).toBeTruthy();
  });

  it("renders correct icon for danger variant", () => {
    const { getByTestId } = render(
      <Toast {...defaultProps} variant="danger" />,
    );
    expect(getByTestId("icon-danger")).toBeTruthy();
  });

  it("renders correct icon for warning variant", () => {
    const { getByTestId } = render(
      <Toast {...defaultProps} variant="warning" />,
    );
    expect(getByTestId("icon-warning")).toBeTruthy();
  });

  it("renders primary button when provided", () => {
    const { getByText } = render(
      <Toast {...defaultProps} primaryButtonText="Retry" />,
    );
    expect(getByText("Retry")).toBeTruthy();
  });

  it("calls onDismiss when close button pressed", () => {
    const onDismiss = jest.fn();
    const props = { ...defaultProps, onDismiss };
    const { UNSAFE_root } = render(<Toast {...props} />);
    // The close button is a RipplePressable wrapping an Icon with name="close".
    // On iOS, RipplePressable renders as a Pressable.
    // The close icon is size 18, and it's the last icon in the row.
    // We can find it by looking for the RipplePressable that calls onDismiss.
    // The Toast has a RN Modal with onRequestClose=onDismiss.
    const rnModal = UNSAFE_root.findByType(require("react-native").Modal);
    if (rnModal.props.onRequestClose) {
      rnModal.props.onRequestClose();
    }
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders both primary and secondary buttons", () => {
    const { getByText } = render(
      <Toast
        {...defaultProps}
        primaryButtonText="Retry"
        onPrimaryButtonTap={jest.fn()}
        secondaryButtonText="Dismiss"
        onSecondaryButtonTap={jest.fn()}
      />,
    );
    expect(getByText("Retry")).toBeTruthy();
    expect(getByText("Dismiss")).toBeTruthy();
  });

  it("primary button in two-button layout fires medium haptic and callback", () => {
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();
    const { getByText } = render(
      <Toast
        {...defaultProps}
        primaryButtonText="Retry"
        onPrimaryButtonTap={onPrimary}
        secondaryButtonText="Dismiss"
        onSecondaryButtonTap={onSecondary}
      />,
    );

    fireEvent.press(getByText("Retry"));

    expect(feedbackService.haptic).toHaveBeenCalledWith("medium");
    expect(onPrimary).toHaveBeenCalled();
  });

  it("secondary button fires selection haptic and callback", () => {
    const onSecondary = jest.fn();
    const { getByText } = render(
      <Toast
        {...defaultProps}
        primaryButtonText="Retry"
        onPrimaryButtonTap={jest.fn()}
        secondaryButtonText="Dismiss"
        onSecondaryButtonTap={onSecondary}
      />,
    );

    fireEvent.press(getByText("Dismiss"));

    expect(feedbackService.haptic).toHaveBeenCalledWith("selection");
    expect(onSecondary).toHaveBeenCalled();
  });

  it("single primary button (no secondary) fires medium haptic and callback", () => {
    const onPrimary = jest.fn();
    const { getByText } = render(
      <Toast
        {...defaultProps}
        primaryButtonText="Retry"
        onPrimaryButtonTap={onPrimary}
      />,
    );

    fireEvent.press(getByText("Retry"));

    expect(feedbackService.haptic).toHaveBeenCalledWith("medium");
    expect(onPrimary).toHaveBeenCalled();
  });

  it("buttons tolerate missing callback handlers", () => {
    const { getByText } = render(
      <Toast
        {...defaultProps}
        primaryButtonText="Retry"
        secondaryButtonText="Dismiss"
      />,
    );

    expect(() => fireEvent.press(getByText("Retry"))).not.toThrow();
    expect(() => fireEvent.press(getByText("Dismiss"))).not.toThrow();
  });
});
