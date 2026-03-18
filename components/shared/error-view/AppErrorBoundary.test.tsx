/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";

import { logError } from "@/utils";

import { AppErrorBoundary } from "./AppErrorBoundary";

jest.mock("@/utils", () => ({
  ...jest.requireActual("@/utils"),
  logError: jest.fn(),
  FeatureFlag: { ui: "UI" },
}));

jest.mock("./ErrorView", () => ({
  ErrorView: ({
    errorMessage,
    onRetry,
  }: {
    errorMessage: string;
    onRetry?: () => void;
  }) => {
    const { View, Text, TouchableOpacity } = require("react-native");
    return (
      <View testID="error-view">
        <Text>{errorMessage}</Text>
        {onRetry && (
          <TouchableOpacity testID="retry-button" onPress={onRetry}>
            <Text>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  },
}));

const ThrowingChild = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) throw new Error("Test render error");
  return <Text>Child content</Text>;
};

describe("AppErrorBoundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it("renders children when no error occurs", () => {
    const { getByText } = render(
      <AppErrorBoundary>
        <Text>Hello World</Text>
      </AppErrorBoundary>,
    );
    expect(getByText("Hello World")).toBeTruthy();
  });

  it("catches render errors and displays ErrorView with error message", () => {
    const { getByTestId, getByText } = render(
      <AppErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </AppErrorBoundary>,
    );
    expect(getByTestId("error-view")).toBeTruthy();
    expect(getByText("Test render error")).toBeTruthy();
  });

  it("handleRetry resets error state and re-renders children", () => {
    let shouldThrow = true;
    const ConditionalChild = () => {
      if (shouldThrow) throw new Error("Temporary error");
      return <Text>Recovered</Text>;
    };

    const { getByTestId, getByText } = render(
      <AppErrorBoundary>
        <ConditionalChild />
      </AppErrorBoundary>,
    );

    expect(getByTestId("error-view")).toBeTruthy();

    shouldThrow = false;
    fireEvent.press(getByTestId("retry-button"));

    expect(getByText("Recovered")).toBeTruthy();
  });

  it("componentDidCatch calls logError with error details", () => {
    render(
      <AppErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </AppErrorBoundary>,
    );

    expect(logError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        flag: "UI",
        message: "React render error",
      }),
    );
  });
});
