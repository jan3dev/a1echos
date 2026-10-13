import {
  getAllModels,
  getModelInfo,
  getRecommendedModelId,
  MODEL_REGISTRY,
  ModelId,
  shouldSuggestLargerModel,
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

  // https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3
  it("Parakeet V3 lists exactly the model card's 25 languages", () => {
    const codes = getModelInfo(ModelId.NEMO_PARAKEET_V3).supportedLanguageCodes;
    expect([...(codes ?? [])].sort()).toEqual(
      [
        "bg",
        "hr",
        "cs",
        "da",
        "nl",
        "en",
        "et",
        "fi",
        "fr",
        "de",
        "el",
        "hu",
        "it",
        "lv",
        "lt",
        "mt",
        "pl",
        "pt",
        "ro",
        "sk",
        "sl",
        "es",
        "sv",
        "ru",
        "uk",
      ].sort(),
    );
  });

  it("recommends Parakeet where it covers the language, else Whisper Small", () => {
    expect(getRecommendedModelId("de")).toBe(ModelId.NEMO_PARAKEET_V3);
    expect(getRecommendedModelId("ja")).toBe(ModelId.WHISPER_SMALL);
    expect(getRecommendedModelId("en")).toBe(ModelId.NEMO_PARAKEET_V3);
  });

  it("suggests a larger model only to non-English speakers on Whisper Tiny", () => {
    expect(shouldSuggestLargerModel("de", ModelId.WHISPER_TINY)).toBe(true);
    expect(shouldSuggestLargerModel("en", ModelId.WHISPER_TINY)).toBe(false);
    expect(shouldSuggestLargerModel("de", ModelId.NEMO_PARAKEET_V3)).toBe(
      false,
    );
  });
});
