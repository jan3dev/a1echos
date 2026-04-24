/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";
import React from "react";

import { TestID } from "@/constants";

import { EmptyStateView } from "./EmptyStateView";

jest.mock("react-native-worklets", () => ({
  scheduleOnRN: jest.fn((fn) => fn()),
}));

jest.mock("../../../ui/tooltip/Tooltip", () => ({
  Tooltip: (props: any) => {
    const { View, Text } = require("react-native");
    const { TestID: TID } = require("@/constants");
    return (
      <View testID={TID.Tooltip}>
        <Text>{props.message}</Text>
      </View>
    );
  },
}));

describe("EmptyStateView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders message text via Tooltip", () => {
    const { getByText } = render(
      <EmptyStateView message="Tap to record" shouldDisappear={false} />,
    );
    expect(getByText("Tap to record")).toBeTruthy();
  });

  it("renders without crashing when shouldDisappear=false", () => {
    const { getByTestId } = render(
      <EmptyStateView message="Hello" shouldDisappear={false} />,
    );
    expect(getByTestId(TestID.Tooltip)).toBeTruthy();
  });

  it("renders without crashing when shouldDisappear=true", () => {
    const { getByTestId } = render(
      <EmptyStateView message="Hello" shouldDisappear={true} />,
    );
    expect(getByTestId(TestID.Tooltip)).toBeTruthy();
  });

  it("calls withTiming when shouldDisappear transitions to true", () => {
    const { withTiming } = require("react-native-reanimated");
    const onDisappearComplete = jest.fn();
    const { rerender } = render(
      <EmptyStateView
        message="Hello"
        shouldDisappear={false}
        onDisappearComplete={onDisappearComplete}
      />,
    );
    (withTiming as jest.Mock).mockClear();
    rerender(
      <EmptyStateView
        message="Hello"
        shouldDisappear={true}
        onDisappearComplete={onDisappearComplete}
      />,
    );
    // withTiming should be called for scale and opacity animations
    expect(withTiming).toHaveBeenCalled();
  });

  it("calls withSpring when shouldDisappear is false (reset animation)", () => {
    const { withSpring } = require("react-native-reanimated");
    (withSpring as jest.Mock).mockClear();
    render(<EmptyStateView message="Hello" shouldDisappear={false} />);
    // withSpring is called to reset scale and opacity to 1
    expect(withSpring).toHaveBeenCalled();
  });

  it("renders different messages correctly", () => {
    const { getByText, rerender } = render(
      <EmptyStateView message="First message" shouldDisappear={false} />,
    );
    expect(getByText("First message")).toBeTruthy();

    rerender(
      <EmptyStateView message="Second message" shouldDisappear={false} />,
    );
    expect(getByText("Second message")).toBeTruthy();
  });

  it("does not crash when onDisappearComplete is undefined and shouldDisappear is true", () => {
    expect(() => {
      render(<EmptyStateView message="Hello" shouldDisappear={true} />);
    }).not.toThrow();
  });

  it("onDisappearComplete is called via scheduleOnRN when animation finishes", () => {
    const { withTiming } = require("react-native-reanimated");
    const { scheduleOnRN } = require("react-native-worklets");
    const onDisappearComplete = jest.fn();

    // Mock withTiming to immediately call the callback with finished=true
    (withTiming as jest.Mock).mockImplementation(
      (
        _toValue: number,
        _config: any,
        callback?: (finished: boolean) => void,
      ) => {
        if (callback) {
          callback(true);
        }
        return _toValue;
      },
    );

    render(
      <EmptyStateView
        message="Hello"
        shouldDisappear={true}
        onDisappearComplete={onDisappearComplete}
      />,
    );

    expect(scheduleOnRN).toHaveBeenCalledWith(onDisappearComplete);
  });

  it("withTiming callback does not call scheduleOnRN when finished is false", () => {
    const { withTiming } = require("react-native-reanimated");
    const { scheduleOnRN } = require("react-native-worklets");
    const onDisappearComplete = jest.fn();

    (scheduleOnRN as jest.Mock).mockClear();

    // Mock withTiming to call callback with finished=false
    (withTiming as jest.Mock).mockImplementation(
      (
        _toValue: number,
        _config: any,
        callback?: (finished: boolean) => void,
      ) => {
        if (callback) {
          callback(false);
        }
        return _toValue;
      },
    );

    render(
      <EmptyStateView
        message="Hello"
        shouldDisappear={true}
        onDisappearComplete={onDisappearComplete}
      />,
    );

    // scheduleOnRN should NOT be called because finished=false
    expect(scheduleOnRN).not.toHaveBeenCalledWith(onDisappearComplete);
  });
});
