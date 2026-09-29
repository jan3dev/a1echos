import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import * as LocalAuthentication from "expo-local-authentication";
import React from "react";
import { AppState } from "react-native";

import { TestID } from "@/constants";
import { useSettingsStore } from "@/stores";

import { BiometricLock } from "./BiometricLock";

const authenticate = LocalAuthentication.authenticateAsync as jest.Mock;

let appStateListener: ((state: string) => void) | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  appStateListener = undefined;
  jest.spyOn(AppState, "addEventListener").mockImplementation(((
    _: string,
    cb: (state: string) => void,
  ) => {
    appStateListener = cb;
    return { remove: jest.fn() };
  }) as never);
  Object.defineProperty(AppState, "currentState", {
    value: "active",
    configurable: true,
  });
});

const setEnabled = (value: boolean) =>
  useSettingsStore.setState({ biometricAuthEnabled: value });

describe("BiometricLock", () => {
  it("renders nothing and never prompts when disabled", () => {
    setEnabled(false);
    const { queryByTestId } = render(<BiometricLock />);
    expect(queryByTestId(TestID.BiometricLockScreen)).toBeNull();
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("prompts on cold start and unlocks on success", async () => {
    setEnabled(true);
    const { queryByTestId } = render(<BiometricLock />);
    await waitFor(() =>
      expect(queryByTestId(TestID.BiometricLockScreen)).toBeNull(),
    );
    expect(authenticate).toHaveBeenCalledTimes(1);
  });

  it("stays locked on cancel and retries via the unlock button", async () => {
    setEnabled(true);
    authenticate.mockResolvedValueOnce({
      success: false,
      error: "user_cancel",
    });
    const { getByTestId, queryByTestId } = render(<BiometricLock />);
    await waitFor(() => expect(authenticate).toHaveBeenCalledTimes(1));
    expect(getByTestId(TestID.BiometricLockScreen)).toBeTruthy();

    fireEvent.press(getByTestId(TestID.BiometricLockUnlockButton));
    await waitFor(() =>
      expect(queryByTestId(TestID.BiometricLockScreen)).toBeNull(),
    );
    expect(authenticate).toHaveBeenCalledTimes(2);
  });

  it("re-locks after backgrounding, but not on inactive", async () => {
    setEnabled(true);
    const { queryByTestId } = render(<BiometricLock />);
    await waitFor(() =>
      expect(queryByTestId(TestID.BiometricLockScreen)).toBeNull(),
    );

    act(() => {
      appStateListener?.("inactive");
      appStateListener?.("active");
    });
    expect(authenticate).toHaveBeenCalledTimes(1);

    authenticate.mockResolvedValueOnce({
      success: false,
      error: "user_cancel",
    });
    act(() => appStateListener?.("background"));
    expect(queryByTestId(TestID.BiometricLockScreen)).toBeTruthy();
    await act(async () => appStateListener?.("active"));
    expect(authenticate).toHaveBeenCalledTimes(2);
    expect(queryByTestId(TestID.BiometricLockScreen)).toBeTruthy();
  });

  it("logs and stays locked when authentication throws", async () => {
    setEnabled(true);
    authenticate.mockRejectedValueOnce(new Error("boom"));
    const { getByTestId } = render(<BiometricLock />);
    await waitFor(() => expect(authenticate).toHaveBeenCalled());
    expect(getByTestId(TestID.BiometricLockScreen)).toBeTruthy();
  });

  it("unlocks when the device no longer has any auth set up", async () => {
    setEnabled(true);
    authenticate.mockResolvedValueOnce({
      success: false,
      error: "passcode_not_set",
    });
    const { queryByTestId } = render(<BiometricLock />);
    await waitFor(() =>
      expect(queryByTestId(TestID.BiometricLockScreen)).toBeNull(),
    );
  });

  it("ignores the background event from Android's PIN fallback", async () => {
    setEnabled(true);
    let resolveAuth: (value: { success: boolean }) => void = () => {};
    authenticate.mockImplementationOnce(
      () => new Promise((resolve) => (resolveAuth = resolve)),
    );
    const { queryByTestId } = render(<BiometricLock />);
    act(() => appStateListener?.("background"));
    await act(async () => resolveAuth({ success: true }));
    act(() => appStateListener?.("active"));

    expect(queryByTestId(TestID.BiometricLockScreen)).toBeNull();
    expect(authenticate).toHaveBeenCalledTimes(1);
  });

  it("defers the prompt to the first active event on a background launch", async () => {
    setEnabled(true);
    Object.defineProperty(AppState, "currentState", {
      value: "background",
      configurable: true,
    });
    const { queryByTestId } = render(<BiometricLock />);
    expect(authenticate).not.toHaveBeenCalled();

    await act(async () => appStateListener?.("active"));
    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(queryByTestId(TestID.BiometricLockScreen)).toBeNull();
  });
});
