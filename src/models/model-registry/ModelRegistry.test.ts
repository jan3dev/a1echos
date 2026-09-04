import {
  getAllModels,
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
});
