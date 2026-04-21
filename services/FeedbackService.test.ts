import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as Haptics from "expo-haptics";

import { useSettingsStore } from "@/stores/settingsStore";

import { feedbackService, HapticKind, SOUND_KINDS } from "./FeedbackService";

jest.mock("@/utils", () => ({
  FeatureFlag: { service: "SERVICE" },
  logWarn: jest.fn(),
}));

type MockPlayer = {
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
  remove: jest.Mock;
};

const makeMockPlayer = (): MockPlayer => ({
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn(),
  remove: jest.fn(),
});

describe("FeedbackService", () => {
  let mockPlayers: MockPlayer[];

  beforeEach(() => {
    mockPlayers = [];
    (createAudioPlayer as jest.Mock).mockImplementation(() => {
      const player = makeMockPlayer();
      mockPlayers.push(player);
      return player;
    });
    feedbackService.dispose();
    useSettingsStore.setState({
      isHapticsEnabled: true,
      isSoundsEnabled: true,
      isIncognitoMode: false,
    });
    feedbackService.setRecordingActive(false);
  });

  describe("initialize()", () => {
    it("sets audio mode and preloads one player per sound kind", async () => {
      await feedbackService.initialize();

      expect(setAudioModeAsync).toHaveBeenCalledWith({
        playsInSilentMode: false,
        allowsRecording: false,
        shouldPlayInBackground: false,
      });
      expect(createAudioPlayer).toHaveBeenCalledTimes(SOUND_KINDS.length);
    });

    it("is idempotent — subsequent calls do not re-preload", async () => {
      await feedbackService.initialize();
      await feedbackService.initialize();

      expect(createAudioPlayer).toHaveBeenCalledTimes(SOUND_KINDS.length);
    });

    it("swallows audio mode errors without throwing", async () => {
      (setAudioModeAsync as jest.Mock).mockRejectedValueOnce(
        new Error("mode fail"),
      );

      await expect(feedbackService.initialize()).resolves.toBeUndefined();
    });

    it("swallows createAudioPlayer errors per sound", async () => {
      (createAudioPlayer as jest.Mock)
        .mockImplementationOnce(() => {
          throw new Error("load fail");
        })
        .mockImplementation(() => {
          const player = makeMockPlayer();
          mockPlayers.push(player);
          return player;
        });

      await expect(feedbackService.initialize()).resolves.toBeUndefined();
    });
  });

  describe("haptic()", () => {
    it("no-ops when haptics are disabled", () => {
      useSettingsStore.setState({ isHapticsEnabled: false });

      feedbackService.haptic("medium");
      feedbackService.haptic("success");
      feedbackService.haptic("selection");

      expect(Haptics.impactAsync).not.toHaveBeenCalled();
      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
      expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    });

    it("routes selection → selectionAsync", () => {
      feedbackService.haptic("selection");
      expect(Haptics.selectionAsync).toHaveBeenCalled();
    });

    it.each<[HapticKind, string]>([
      ["light", "light"],
      ["medium", "medium"],
      ["heavy", "heavy"],
      ["rigid", "rigid"],
      ["soft", "soft"],
    ])("routes %s → impactAsync(%s)", (kind, style) => {
      feedbackService.haptic(kind);
      expect(Haptics.impactAsync).toHaveBeenCalledWith(style);
    });

    it.each<[HapticKind, string]>([
      ["success", "success"],
      ["warning", "warning"],
      ["error", "error"],
    ])("routes %s → notificationAsync(%s)", (kind, type) => {
      feedbackService.haptic(kind);
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(type);
    });

    it("swallows haptic errors", () => {
      (Haptics.impactAsync as jest.Mock).mockImplementationOnce(() => {
        throw new Error("haptic fail");
      });

      expect(() => feedbackService.haptic("medium")).not.toThrow();
    });
  });

  describe("sound()", () => {
    beforeEach(async () => {
      await feedbackService.initialize();
    });

    it("plays the requested sound via seekTo(0) + play()", () => {
      feedbackService.sound("recStart");

      const played = mockPlayers.find((p) => p.play.mock.calls.length > 0);
      expect(played).toBeDefined();
      expect(played!.seekTo).toHaveBeenCalledWith(0);
    });

    it("no-ops when sounds are disabled", () => {
      useSettingsStore.setState({ isSoundsEnabled: false });

      feedbackService.sound("recStart");

      mockPlayers.forEach((p) => expect(p.play).not.toHaveBeenCalled());
    });

    it("no-ops when incognito mode is on", () => {
      useSettingsStore.setState({ isIncognitoMode: true });

      feedbackService.sound("recStart");

      mockPlayers.forEach((p) => expect(p.play).not.toHaveBeenCalled());
    });

    it("no-ops when recording is active", () => {
      feedbackService.setRecordingActive(true);

      feedbackService.sound("recStart");

      mockPlayers.forEach((p) => expect(p.play).not.toHaveBeenCalled());
    });

    it("resumes playing after recording ends", () => {
      feedbackService.setRecordingActive(true);
      feedbackService.sound("recStart");
      feedbackService.setRecordingActive(false);

      feedbackService.sound("recStop");

      const played = mockPlayers.find((p) => p.play.mock.calls.length > 0);
      expect(played).toBeDefined();
    });

    it("swallows player errors", () => {
      mockPlayers.forEach((p) => {
        p.play.mockImplementation(() => {
          throw new Error("play fail");
        });
      });

      expect(() => feedbackService.sound("recStart")).not.toThrow();
    });

    it("no-ops when player is missing (init failed)", () => {
      feedbackService.dispose();

      expect(() => feedbackService.sound("recStart")).not.toThrow();
    });

    it("awaits seekTo promise before calling play when seekTo is async", async () => {
      const target = mockPlayers[0];
      target.seekTo.mockReturnValue(Promise.resolve());

      feedbackService.sound("recStart");

      // play should NOT have fired synchronously
      expect(target.play).not.toHaveBeenCalled();
      await Promise.resolve();
      expect(target.play).toHaveBeenCalled();
    });

    it("swallows rejected seekTo promise", async () => {
      const target = mockPlayers[0];
      target.seekTo.mockReturnValue(Promise.reject(new Error("seek fail")));

      expect(() => feedbackService.sound("recStart")).not.toThrow();
      await new Promise((r) => setImmediate(r));
    });
  });

  describe("tap()", () => {
    beforeEach(async () => {
      await feedbackService.initialize();
    });

    it("fires selection haptic with no sound", () => {
      feedbackService.tap();

      expect(Haptics.selectionAsync).toHaveBeenCalled();
      mockPlayers.forEach((p) => expect(p.play).not.toHaveBeenCalled());
    });

    it("fires selection haptic and the specified sound", () => {
      feedbackService.tap("toggle");

      expect(Haptics.selectionAsync).toHaveBeenCalled();
      const played = mockPlayers.find((p) => p.play.mock.calls.length > 0);
      expect(played).toBeDefined();
    });
  });

  describe("dispose()", () => {
    it("removes all players and allows re-initialization", async () => {
      await feedbackService.initialize();
      const playersBeforeDispose = [...mockPlayers];

      feedbackService.dispose();

      playersBeforeDispose.forEach((p) => expect(p.remove).toHaveBeenCalled());

      await feedbackService.initialize();
      expect(createAudioPlayer).toHaveBeenCalledTimes(SOUND_KINDS.length * 2);
    });

    it("swallows remove errors", async () => {
      await feedbackService.initialize();
      mockPlayers.forEach((p) => {
        p.remove.mockImplementation(() => {
          throw new Error("remove fail");
        });
      });

      expect(() => feedbackService.dispose()).not.toThrow();
    });

    it("clears recordingActive flag so post-dispose sounds are not gated", async () => {
      await feedbackService.initialize();
      feedbackService.setRecordingActive(true);

      feedbackService.dispose();
      await feedbackService.initialize();

      feedbackService.sound("recStart");
      const played = mockPlayers.find((p) => p.play.mock.calls.length > 0);
      expect(played).toBeDefined();
    });
  });
});
