import {
  getAllDownloadableModels,
  getAllLlms,
  getDownloadableModel,
  getLlmInfo,
  getRecommendedLlmId,
  LlmModelId,
  ModelId,
} from "../";

describe("LlmRegistry", () => {
  // `main` can be force-pushed; a released build must fetch the exact GGUF
  // that was benchmarked.
  it("pins every LLM to a HuggingFace commit", () => {
    for (const llm of getAllLlms()) {
      expect(llm.downloadBaseUrl).toMatch(
        /^https:\/\/huggingface\.co\/[^/]+\/[^/]+\/resolve\/[0-9a-f]{40}$/,
      );
      expect(llm.files).toHaveLength(1);
      expect(llm.files[0].name).toMatch(/\.gguf$/);
      expect(llm.files[0].sizeBytes).toBe(llm.sizeBytes);
    }
  });

  it("resolves both ASR models and LLMs as downloadable", () => {
    expect(getDownloadableModel(ModelId.WHISPER_BASE).id).toBe(
      ModelId.WHISPER_BASE,
    );
    expect(getDownloadableModel(LlmModelId.QWEN35_2B)).toBe(
      getLlmInfo(LlmModelId.QWEN35_2B),
    );
    const ids = getAllDownloadableModels().map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(Object.values(LlmModelId)));
    expect(ids).toEqual(expect.arrayContaining(Object.values(ModelId)));
  });

  // OS-reported totals sit below the marketed size (8 GB phones report ~7.5).
  it.each([
    [3.6e9, LlmModelId.QWEN35_0_8B],
    [5.6e9, LlmModelId.QWEN35_2B],
    [7.5e9, LlmModelId.QWEN35_4B],
    [16e9, LlmModelId.QWEN35_4B],
  ])("recommends for %d bytes of RAM: %s", (ram, expected) => {
    expect(getRecommendedLlmId(ram)).toBe(expected);
  });
});
