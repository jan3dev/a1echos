import { renderHook } from "@testing-library/react-native";

import { useLocalization } from "./useLocalization";

describe("useLocalization", () => {
  it("returns a t function", () => {
    const { result } = renderHook(() => useLocalization());
    expect(typeof result.current.t).toBe("function");
  });

  it("returns loc object with all expected simple string keys", () => {
    const { result } = renderHook(() => useLocalization());
    const { loc } = result.current;

    const expectedStringKeys = [
      "sessionRenameTitle",
      "delete",
      "modifiedPrefix",
      "createdPrefix",
      "save",
      "cancel",
      "edit",
      "share",
      "sessionNameLabel",
      "sessionNameMaxLengthHelper",
      "homeDeleteSelectedSessionsTitle",
      "followUsOnX",
      "couldNotOpenLink",
      "incognitoModeTitle",
      "incognitoExplainerTitle",
      "incognitoExplainerBody",
      "incognitoExplainerCta",
      "errorPrefix",
      "recordingPrefix",
      "retry",
      "emptySessionsMessage",
      "homeMicrophoneDenied",
      "homeMicrophonePermissionRequired",
      "homeFailedStartRecording",
      "sessionDeleteTranscriptionsTitle",
      "allTranscriptionsCopied",
      "noTranscriptionsToCopy",
      "noTranscriptionsSelectedToShare",
      "sessionNotFound",
      "settingsTitle",
      "modelTitle",
      "themeTitle",
      "spokenLanguageTitle",
      "auto",
      "light",
      "dark",
      "whisperModelRealtimeTitle",
      "whisperModelFileTitle",
      "whisperModelRealtimeSubtitle",
      "whisperModelFileSubtitle",
      "modelDescription",
      "spokenLanguageDescription",
      "recordingTooShort",
      "transcriptionFailed",
      "failedToInitializeEngine",
      "copiedToClipboard",
      "contactSupport",
    ];

    for (const key of expectedStringKeys) {
      expect(typeof (loc as Record<string, unknown>)[key]).toBe("string");
    }
  });

  it("simple string loc entries equal t(key) (the key itself in mock)", () => {
    const { result } = renderHook(() => useLocalization());
    const { loc } = result.current;

    // The mock t function returns the key string, so simple entries should be the i18n key
    expect(loc.delete).toBe("delete");
    expect(loc.save).toBe("save");
    expect(loc.cancel).toBe("cancel");
    expect(loc.settingsTitle).toBe("settingsTitle");
  });

  it("function entries call t with interpolation params", () => {
    const { result } = renderHook(() => useLocalization());
    const { loc, t } = result.current;

    loc.homeSessionsDeleted(3);
    expect(t).toHaveBeenCalledWith("homeSessionsDeleted", { count: 3 });

    loc.transcriptionCount(5);
    expect(t).toHaveBeenCalledWith("transcriptionCount", { count: 5 });

    loc.homeDeleteSelectedSessionsMessage(2);
    expect(t).toHaveBeenCalledWith("homeDeleteSelectedSessionsMessage", {
      count: 2,
    });

    loc.sessionDeleteTranscriptionsMessage(4);
    expect(t).toHaveBeenCalledWith("sessionDeleteTranscriptionsMessage", {
      count: 4,
    });

    loc.sessionTranscriptionsDeleted(1);
    expect(t).toHaveBeenCalledWith("sessionTranscriptionsDeleted", {
      count: 1,
    });
  });

  it("homeErrorCreatingSession passes error string", () => {
    const { result } = renderHook(() => useLocalization());
    const { loc, t } = result.current;

    loc.homeErrorCreatingSession("timeout");
    expect(t).toHaveBeenCalledWith("homeErrorCreatingSession", {
      error: "timeout",
    });
  });

  it("copyFailed and shareFailed pass error string", () => {
    const { result } = renderHook(() => useLocalization());
    const { loc, t } = result.current;

    loc.copyFailed("clipboard error");
    expect(t).toHaveBeenCalledWith("copyFailed", { error: "clipboard error" });

    loc.shareFailed("share sheet error");
    expect(t).toHaveBeenCalledWith("shareFailed", {
      error: "share sheet error",
    });
  });
});
