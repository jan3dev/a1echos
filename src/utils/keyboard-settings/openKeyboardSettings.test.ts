import { Linking, Platform } from "react-native";

import { openKeyboardSettings } from "./openKeyboardSettings";

const mockOpenSettings = Linking.openSettings as jest.Mock;
const mockSendIntent = Linking.sendIntent as jest.Mock;

const setPlatform = (os: "ios" | "android") => {
  Object.defineProperty(Platform, "OS", {
    value: os,
    writable: true,
    configurable: true,
  });
};

describe("openKeyboardSettings", () => {
  beforeEach(() => {
    mockOpenSettings.mockReset();
    mockSendIntent.mockReset();
  });

  it("opens iOS Settings on iOS", async () => {
    setPlatform("ios");
    mockOpenSettings.mockResolvedValueOnce(undefined);

    const result = await openKeyboardSettings();

    expect(result).toBe(true);
    expect(mockOpenSettings).toHaveBeenCalledTimes(1);
    expect(mockSendIntent).not.toHaveBeenCalled();
  });

  it("sends INPUT_METHOD_SETTINGS intent on Android", async () => {
    setPlatform("android");
    mockSendIntent.mockResolvedValueOnce(undefined);

    const result = await openKeyboardSettings();

    expect(result).toBe(true);
    expect(mockSendIntent).toHaveBeenCalledWith(
      "android.settings.INPUT_METHOD_SETTINGS",
    );
    expect(mockOpenSettings).not.toHaveBeenCalled();
  });

  it("returns false and swallows iOS errors", async () => {
    setPlatform("ios");
    mockOpenSettings.mockRejectedValueOnce(new Error("nope"));

    const result = await openKeyboardSettings();

    expect(result).toBe(false);
  });

  it("returns false and swallows Android errors", async () => {
    setPlatform("android");
    mockSendIntent.mockRejectedValueOnce(new Error("nope"));

    const result = await openKeyboardSettings();

    expect(result).toBe(false);
  });
});
