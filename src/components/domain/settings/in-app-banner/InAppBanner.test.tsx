/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import * as Linking from "expo-linking";
import React from "react";

import { InAppBanner } from "./InAppBanner";

beforeEach(() => {
  jest.clearAllMocks();
  (Linking as any).canOpenURL = jest.fn(async () => true);
});

describe("InAppBanner", () => {
  it('has accessibility label "Download AQUA Wallet"', () => {
    const { getByLabelText } = render(<InAppBanner />);
    expect(getByLabelText("Download AQUA Wallet")).toBeTruthy();
  });

  it('has accessibility role "link"', () => {
    const { getByRole } = render(<InAppBanner />);
    expect(getByRole("link")).toBeTruthy();
  });

  it("press opens URL via Linking", async () => {
    const { getByRole } = render(<InAppBanner />);
    fireEvent.press(getByRole("link"));
    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalled();
    });
  });

  it("still opens URL when canOpenURL returns false (fallback)", async () => {
    (Linking as any).canOpenURL = jest.fn(async () => false);
    const { getByRole } = render(<InAppBanner />);
    fireEvent.press(getByRole("link"));
    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalled();
    });
  });

  it("handles error when canOpenURL throws", async () => {
    (Linking as any).canOpenURL = jest.fn(async () => {
      throw new Error("network error");
    });
    const { getByRole } = render(<InAppBanner />);
    fireEvent.press(getByRole("link"));
    // Should not crash
    await waitFor(() => {
      expect(Linking.openURL).not.toHaveBeenCalled();
    });
  });

  it("uses Android URL when Platform.OS is android", async () => {
    const { Platform } = require("react-native");
    const originalOS = Platform.OS;
    Platform.OS = "android";

    const { getByRole } = render(<InAppBanner />);
    fireEvent.press(getByRole("link"));
    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith(
        "https://play.google.com/store/apps/details?id=io.aquawallet.android",
      );
    });

    Platform.OS = originalOS;
  });
});
