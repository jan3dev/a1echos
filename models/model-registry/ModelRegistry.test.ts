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
});
