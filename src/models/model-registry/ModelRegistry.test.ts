import {
  getAllModels,
  getAsrModels,
  getBundledModels,
  getDownloadableModels,
  getModelInfo,
  MODEL_REGISTRY,
  ModelId,
} from "../";

describe("ModelRegistry", () => {
  it("getModelInfo returns the bundled Whisper Tiny entry", () => {
    const info = getModelInfo(ModelId.WHISPER_TINY);
    expect(info.id).toBe(ModelId.WHISPER_TINY);
    expect(info.isBundled).toBe(true);
  });

  it("getAllModels returns every entry in MODEL_REGISTRY", () => {
    const all = getAllModels();
    expect(all).toHaveLength(Object.keys(MODEL_REGISTRY).length);
  });

  it("getBundledModels returns only bundled models", () => {
    const bundled = getBundledModels();
    expect(bundled.length).toBeGreaterThan(0);
    expect(bundled.every((m) => m.isBundled)).toBe(true);
  });

  it("getDownloadableModels returns only non-bundled models", () => {
    const downloadable = getDownloadableModels();
    expect(downloadable.every((m) => !m.isBundled)).toBe(true);
  });

  // HuggingFace's file page is `/blob/main`, which serves HTML — copying that
  // URL out of the web UI would write a web page into the model file and only
  // fail at load time. Only `/resolve/main` returns the raw bytes.
  it("every downloadable model resolves raw HuggingFace bytes", () => {
    const nonBundled = getAllModels().filter((m) => !m.isBundled);
    expect(nonBundled.length).toBeGreaterThan(0);
    for (const model of nonBundled) {
      expect(model.downloadBaseUrl).toMatch(
        /^https:\/\/huggingface\.co\/[^/]+\/[^/]+\/resolve\/main$/,
      );
    }
  });
  describe("ASR filtering", () => {
    // The keyboard LM reuses ModelInfo and the download pipeline but is not a
    // transcription model. Without these, dropping the `kind` filter would
    // silently offer it as a speech model in every picker.
    it("getAsrModels excludes the keyboard LM", () => {
      const ids = getAsrModels().map((m) => m.id);
      expect(ids).not.toContain(ModelId.KEYBOARD_LM);
      expect(ids.length).toBe(getAllModels().length - 1);
    });

    it("getAsrModels returns every non-LM entry", () => {
      expect(getAsrModels().every((m) => (m.kind ?? "asr") === "asr")).toBe(
        true,
      );
    });

    it("getDownloadableModels excludes the keyboard LM", () => {
      expect(getDownloadableModels().map((m) => m.id)).not.toContain(
        ModelId.KEYBOARD_LM,
      );
    });

    it("getBundledModels excludes the keyboard LM", () => {
      expect(getBundledModels().map((m) => m.id)).not.toContain(
        ModelId.KEYBOARD_LM,
      );
    });

    it("the keyboard LM is still reachable for downloading", () => {
      const info = getModelInfo(ModelId.KEYBOARD_LM);
      expect(info.kind).toBe("keyboard-lm");
      expect(info.isBundled).toBe(false);
      expect(info.files).toHaveLength(1);
      expect(info.downloadBaseUrl).toBeTruthy();
    });
  });
});
