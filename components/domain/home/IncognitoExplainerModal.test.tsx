/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { IncognitoExplainerModal } from "./IncognitoExplainerModal";

let capturedModalProps: any = {};

jest.mock("../../ui/modal/Modal", () => ({
  Modal: (props: any) => {
    capturedModalProps = props;
    const { View, Text, Pressable } = require("react-native");
    return (
      <View testID="modal">
        <Text testID="modal-title">{props.title}</Text>
        <Text testID="modal-message">{props.message}</Text>
        {props.primaryButton && (
          <Pressable
            testID="primary-button"
            onPress={props.primaryButton.onTap}
          />
        )}
      </View>
    );
  },
}));

jest.mock("../../ui/icon/Icon", () => ({
  Icon: (props: any) => {
    const { View } = require("react-native");
    return <View testID={`icon-${props.name}`} />;
  },
}));

describe("IncognitoExplainerModal", () => {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    capturedModalProps = {};
  });

  it("renders Modal with title from localization", () => {
    const { getByTestId } = render(
      <IncognitoExplainerModal
        visible={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(getByTestId("modal-title").props.children).toBe(
      "incognitoExplainerTitle",
    );
  });

  it("renders Modal with message from localization", () => {
    const { getByTestId } = render(
      <IncognitoExplainerModal
        visible={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(getByTestId("modal-message").props.children).toBe(
      "incognitoExplainerBody",
    );
  });

  it("primary button onTap calls onConfirm", () => {
    const { getByTestId } = render(
      <IncognitoExplainerModal
        visible={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.press(getByTestId("primary-button"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("onDismiss calls onCancel", () => {
    render(
      <IncognitoExplainerModal
        visible={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(capturedModalProps.onDismiss).toBe(onCancel);
    capturedModalProps.onDismiss();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("passes visible=false to Modal", () => {
    render(
      <IncognitoExplainerModal
        visible={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(capturedModalProps.visible).toBe(false);
  });

  it("passes visible=true to Modal", () => {
    render(
      <IncognitoExplainerModal
        visible={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(capturedModalProps.visible).toBe(true);
  });

  it("passes iconVariant as info", () => {
    render(
      <IncognitoExplainerModal
        visible={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(capturedModalProps.iconVariant).toBe("info");
  });

  it("passes ghost icon", () => {
    render(
      <IncognitoExplainerModal
        visible={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(capturedModalProps.icon).toBeTruthy();
  });

  it("primary button text uses localization CTA", () => {
    render(
      <IncognitoExplainerModal
        visible={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(capturedModalProps.primaryButton.text).toBe("incognitoExplainerCta");
  });

  it("passes testID to Modal", () => {
    render(
      <IncognitoExplainerModal
        visible={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(capturedModalProps.testID).toBe("incognito-modal");
  });
});
