import { ModelId, TranscriptionState } from "@/models";
import { modelDownloadService, sherpaTranscriptionService } from "@/services";

import { preWarmModel } from "./preWarmModel";
import { useTranscriptionStore } from "./transcriptionStore";

jest.mock("@/services", () => ({
  modelDownloadService: {
    isModelDownloaded: jest.fn(() => true),
  },
  sherpaTranscriptionService: {
    initialize: jest.fn(async () => true),
  },
}));

jest.mock("@/utils", () => ({
  FeatureFlag: { model: "MODEL" },
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

describe("preWarmModel", () => {
  beforeEach(() => {
    useTranscriptionStore.setState({ state: TranscriptionState.READY });
    (modelDownloadService.isModelDownloaded as jest.Mock).mockReturnValue(true);
    (sherpaTranscriptionService.initialize as jest.Mock).mockResolvedValue(
      true,
    );
  });

  it("calls sherpa initialize with the requested model and language", async () => {
    preWarmModel(ModelId.NEMO_PARAKEET_V3, "es");
    await flushMicrotasks();
    expect(sherpaTranscriptionService.initialize).toHaveBeenCalledWith(
      ModelId.NEMO_PARAKEET_V3,
      "es",
    );
  });

  it("flips isEngineInitializing on while in flight and off when settled", async () => {
    let resolveInit!: (value: boolean) => void;
    const initPromise = new Promise<boolean>((resolve) => {
      resolveInit = resolve;
    });
    (sherpaTranscriptionService.initialize as jest.Mock).mockReturnValueOnce(
      initPromise,
    );

    preWarmModel(ModelId.NEMO_PARAKEET_V3, "en");
    expect(useTranscriptionStore.getState().isEngineInitializing).toBe(true);

    resolveInit(true);
    await flushMicrotasks();
    await flushMicrotasks();
    expect(useTranscriptionStore.getState().isEngineInitializing).toBe(false);
  });

  it("clears isEngineInitializing even when sherpa initialize rejects", async () => {
    (sherpaTranscriptionService.initialize as jest.Mock).mockRejectedValueOnce(
      new Error("boom"),
    );
    preWarmModel(ModelId.NEMO_PARAKEET_V3, "en");
    expect(useTranscriptionStore.getState().isEngineInitializing).toBe(true);
    await flushMicrotasks();
    await flushMicrotasks();
    expect(useTranscriptionStore.getState().isEngineInitializing).toBe(false);
  });

  it("does not flip isEngineInitializing when guard rejects (busy state)", () => {
    useTranscriptionStore.setState({ state: TranscriptionState.RECORDING });
    preWarmModel(ModelId.NEMO_PARAKEET_V3, "en");
    expect(useTranscriptionStore.getState().isEngineInitializing).toBe(false);
  });

  it("does not flip isEngineInitializing when model is not downloaded", () => {
    (modelDownloadService.isModelDownloaded as jest.Mock).mockReturnValue(
      false,
    );
    preWarmModel(ModelId.NEMO_PARAKEET_V3, "en");
    expect(useTranscriptionStore.getState().isEngineInitializing).toBe(false);
  });

  it.each([
    TranscriptionState.RECORDING_STARTING,
    TranscriptionState.RECORDING,
    TranscriptionState.STREAMING,
    TranscriptionState.TRANSCRIBING,
    TranscriptionState.LOADING,
  ])("skips initialization when transcription state is %s", (busyState) => {
    useTranscriptionStore.setState({ state: busyState });
    preWarmModel(ModelId.NEMO_PARAKEET_V3, "en");
    expect(sherpaTranscriptionService.initialize).not.toHaveBeenCalled();
  });

  it("skips initialization when the model is not downloaded", () => {
    (modelDownloadService.isModelDownloaded as jest.Mock).mockReturnValue(
      false,
    );
    preWarmModel(ModelId.NEMO_PARAKEET_V3, "en");
    expect(sherpaTranscriptionService.initialize).not.toHaveBeenCalled();
  });

  it("swallows errors from sherpa initialize so callers can fire-and-forget", async () => {
    (sherpaTranscriptionService.initialize as jest.Mock).mockRejectedValueOnce(
      new Error("init blew up"),
    );
    expect(() => preWarmModel(ModelId.NEMO_PARAKEET_V3, "en")).not.toThrow();
    await flushMicrotasks();
    const { logError } = require("@/utils") as { logError: jest.Mock };
    expect(logError).toHaveBeenCalled();
  });
});
