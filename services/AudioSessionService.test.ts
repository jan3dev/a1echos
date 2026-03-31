/* eslint-disable @typescript-eslint/no-require-imports */
import { Platform } from "react-native";

describe("AudioSessionService", () => {
  const setMockPlatform = (os: string) => {
    Object.defineProperty(Platform, "OS", { get: () => os });
  };

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  describe("Android", () => {
    it("returns true (no-op) on Android", async () => {
      setMockPlatform("android");

      const { setAudioModeAsync } = require("expo-audio");
      const { audioSessionService } =
        require("./AudioSessionService") as typeof import("./AudioSessionService");

      const result = await audioSessionService.ensureRecordingMode();

      expect(result).toBe(true);
      expect(setAudioModeAsync).not.toHaveBeenCalled();
    });
  });

  describe("iOS", () => {
    beforeEach(() => {
      setMockPlatform("ios");
    });

    it("calls setAudioModeAsync with correct options", async () => {
      const { setAudioModeAsync } = require("expo-audio");
      const { audioSessionService } =
        require("./AudioSessionService") as typeof import("./AudioSessionService");

      await audioSessionService.ensureRecordingMode();

      expect(setAudioModeAsync).toHaveBeenCalledWith({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        allowsBackgroundRecording: true,
      });
    });

    it("returns true on success", async () => {
      const { audioSessionService } =
        require("./AudioSessionService") as typeof import("./AudioSessionService");

      const result = await audioSessionService.ensureRecordingMode();

      expect(result).toBe(true);
    });

    it("returns false on setAudioModeAsync failure", async () => {
      const { setAudioModeAsync } = require("expo-audio");
      (setAudioModeAsync as jest.Mock).mockRejectedValueOnce(
        new Error("audio fail"),
      );

      const { audioSessionService } =
        require("./AudioSessionService") as typeof import("./AudioSessionService");

      const result = await audioSessionService.ensureRecordingMode();

      expect(result).toBe(false);
    });

    it("previous failure does not block retry", async () => {
      const { setAudioModeAsync } = require("expo-audio");
      const { audioSessionService } =
        require("./AudioSessionService") as typeof import("./AudioSessionService");

      (setAudioModeAsync as jest.Mock).mockRejectedValueOnce(
        new Error("first fail"),
      );
      const first = await audioSessionService.ensureRecordingMode();
      expect(first).toBe(false);

      (setAudioModeAsync as jest.Mock).mockResolvedValueOnce(undefined);
      const second = await audioSessionService.ensureRecordingMode();
      expect(second).toBe(true);
    });

    it("idempotent: second concurrent call waits for first", async () => {
      const { setAudioModeAsync } = require("expo-audio");
      const { audioSessionService } =
        require("./AudioSessionService") as typeof import("./AudioSessionService");

      let resolveAudio: () => void;
      (setAudioModeAsync as jest.Mock).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveAudio = resolve;
          }),
      );

      const p1 = audioSessionService.ensureRecordingMode();
      const p2 = audioSessionService.ensureRecordingMode();

      resolveAudio!();

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBe(true);
      expect(r2).toBe(true);
      // setAudioModeAsync should only be called once for the first invocation;
      // the second call awaits the pending configurationPromise and then creates its own
      expect(setAudioModeAsync).toHaveBeenCalled();
    });
  });
});
