import { EchosKeyboardBridge } from "@modules/echos-keyboard-bridge/src";
import { ModelId } from "@/models";
import { sherpaTranscriptionService } from "@/services";

import { useSettingsStore } from "../settings-store/settingsStore";

import { startKeyboardTranscriptionBridge } from "./keyboardTranscriptionBridge";

jest.mock("@modules/echos-keyboard-bridge/src", () => ({
  EchosKeyboardBridge: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    completeTranscription: jest.fn(),
  },
}));

jest.mock("@/services", () => ({
  sherpaTranscriptionService: {
    initialize: jest.fn(async () => true),
    transcribeWavFile: jest.fn(async () => "  你好  "),
  },
}));

jest.mock("@/utils", () => ({
  FeatureFlag: { model: "MODEL" },
  formatTranscriptionText: (text: string) => text.trim(),
  getErrorMessage: (error: Error) => error.message,
  logError: jest.fn(),
}));

const bridge = EchosKeyboardBridge as unknown as {
  addListener: jest.Mock;
  completeTranscription: jest.Mock;
};

startKeyboardTranscriptionBridge();
const handler = bridge.addListener.mock.calls[0][1];

const request = () => handler({ id: "req-1", path: "/tmp/keyboard.wav" });

describe("startKeyboardTranscriptionBridge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState({
      selectedModelId: ModelId.QWEN3_ASR,
      selectedLanguage: { code: "zh", name: "Chinese" },
    });
  });

  it("transcribes on the app engine with the selected model and language", async () => {
    await request();

    expect(sherpaTranscriptionService.initialize).toHaveBeenCalledWith(
      ModelId.QWEN3_ASR,
      "zh",
    );
    expect(sherpaTranscriptionService.transcribeWavFile).toHaveBeenCalledWith(
      "file:///tmp/keyboard.wav",
    );
    expect(bridge.completeTranscription).toHaveBeenCalledWith(
      "req-1",
      "你好",
      null,
    );
  });

  it("replies with an error when the engine can't load", async () => {
    (sherpaTranscriptionService.initialize as jest.Mock).mockResolvedValueOnce(
      false,
    );

    await request();

    expect(sherpaTranscriptionService.transcribeWavFile).not.toHaveBeenCalled();
    expect(bridge.completeTranscription).toHaveBeenCalledWith(
      "req-1",
      null,
      "Voice model failed to load",
    );
  });

  it("replies with the error when transcription throws", async () => {
    (
      sherpaTranscriptionService.transcribeWavFile as jest.Mock
    ).mockRejectedValueOnce(new Error("Transcription already in progress"));

    await request();

    expect(bridge.completeTranscription).toHaveBeenCalledWith(
      "req-1",
      null,
      "Transcription already in progress",
    );
  });

  it("subscribes only once", () => {
    startKeyboardTranscriptionBridge();

    expect(bridge.addListener).not.toHaveBeenCalled();
  });
});
