import { ModelId, TranscriptionMode } from "../model-type/ModelType";

export interface ModelFileInfo {
  name: string;
  sizeBytes: number;
}

export interface ModelInfo {
  id: ModelId;
  name: string;
  description: string;
  sizeBytes: number;
  supportedModes: TranscriptionMode[];
  isBundled: boolean;
  /** Base URL for downloading individual model files (HuggingFace resolve URL) */
  downloadBaseUrl?: string;
  /** sherpa-onnx model type identifier passed to createSTT */
  sherpaModelType: string;
  files: ModelFileInfo[];
  languages: number;
  /** Language codes supported by this model. Undefined means all languages in SupportedLanguages. */
  supportedLanguageCodes?: string[];
}

/** The 99 language codes Whisper supports, plus the zh-hant UI variant. */
const WHISPER_LANGUAGES = [
  "en",
  "zh",
  "zh-hant",
  "de",
  "es",
  "ru",
  "ko",
  "fr",
  "ja",
  "pt",
  "tr",
  "pl",
  "ca",
  "nl",
  "ar",
  "sv",
  "it",
  "id",
  "hi",
  "fi",
  "vi",
  "he",
  "uk",
  "el",
  "ms",
  "cs",
  "ro",
  "da",
  "hu",
  "ta",
  "no",
  "th",
  "ur",
  "hr",
  "bg",
  "lt",
  "la",
  "mi",
  "ml",
  "cy",
  "sk",
  "te",
  "fa",
  "lv",
  "bn",
  "sr",
  "az",
  "sl",
  "kn",
  "et",
  "mk",
  "br",
  "eu",
  "is",
  "hy",
  "ne",
  "mn",
  "bs",
  "kk",
  "sq",
  "sw",
  "gl",
  "mr",
  "pa",
  "si",
  "km",
  "sn",
  "yo",
  "so",
  "af",
  "oc",
  "ka",
  "be",
  "tg",
  "sd",
  "gu",
  "am",
  "yi",
  "lo",
  "uz",
  "fo",
  "ht",
  "ps",
  "tk",
  "nn",
  "mt",
  "sa",
  "lb",
  "my",
  "bo",
  "tl",
  "mg",
  "as",
  "tt",
  "haw",
  "ln",
  "ha",
  "ba",
  "jw",
  "su",
];

/** Qwen3-ASR supports 30 languages and 22 Chinese dialects (including Cantonese, decoded under zh). */
const QWEN3_LANGUAGES = [
  "zh",
  "zh-hant",
  "en",
  "ar",
  "de",
  "fr",
  "es",
  "pt",
  "id",
  "it",
  "ko",
  "ru",
  "th",
  "vi",
  "ja",
  "tr",
  "hi",
  "ms",
  "nl",
  "sv",
  "da",
  "fi",
  "pl",
  "cs",
  "tl",
  "fa",
  "el",
  "hu",
  "mk",
  "ro",
];

/** Parakeet V3 supports 25 European languages */
const PARAKEET_LANGUAGES = [
  "en",
  "de",
  "es",
  "fr",
  "it",
  "pt",
  "nl",
  "pl",
  "ro",
  "sv",
  "da",
  "fi",
  "no",
  "hu",
  "cs",
  "sk",
  "sl",
  "hr",
  "bg",
  "lt",
  "lv",
  "et",
  "el",
  "uk",
  "sr",
];

export const MODEL_REGISTRY: Record<ModelId, ModelInfo> = {
  [ModelId.WHISPER_TINY]: {
    id: ModelId.WHISPER_TINY,
    name: "Whisper Tiny",
    description: "Fast, lightweight transcription",
    sizeBytes: 103_700_000,
    supportedModes: [TranscriptionMode.FILE, TranscriptionMode.REALTIME],
    isBundled: true,
    sherpaModelType: "whisper",
    files: [
      { name: "tiny-encoder.int8.onnx", sizeBytes: 12_900_000 },
      { name: "tiny-decoder.int8.onnx", sizeBytes: 89_900_000 },
      { name: "tiny-tokens.txt", sizeBytes: 817_000 },
    ],
    languages: WHISPER_LANGUAGES.length,
    supportedLanguageCodes: WHISPER_LANGUAGES,
  },
  [ModelId.WHISPER_BASE]: {
    id: ModelId.WHISPER_BASE,
    name: "Whisper Base",
    description: "Balanced accuracy and speed",
    sizeBytes: 160_609_290,
    supportedModes: [TranscriptionMode.FILE, TranscriptionMode.REALTIME],
    isBundled: false,
    downloadBaseUrl:
      "https://huggingface.co/csukuangfj/sherpa-onnx-whisper-base/resolve/main",
    sherpaModelType: "whisper",
    files: [
      { name: "base-encoder.int8.onnx", sizeBytes: 29_120_534 },
      { name: "base-decoder.int8.onnx", sizeBytes: 130_672_026 },
      { name: "base-tokens.txt", sizeBytes: 816_730 },
    ],
    languages: WHISPER_LANGUAGES.length,
    supportedLanguageCodes: WHISPER_LANGUAGES,
  },
  [ModelId.WHISPER_SMALL]: {
    id: ModelId.WHISPER_SMALL,
    name: "Whisper Small",
    description: "Higher accuracy, larger model",
    sizeBytes: 375_485_327,
    supportedModes: [TranscriptionMode.FILE, TranscriptionMode.REALTIME],
    isBundled: false,
    downloadBaseUrl:
      "https://huggingface.co/csukuangfj/sherpa-onnx-whisper-small/resolve/main",
    sherpaModelType: "whisper",
    files: [
      { name: "small-encoder.int8.onnx", sizeBytes: 112_442_483 },
      { name: "small-decoder.int8.onnx", sizeBytes: 262_226_114 },
      { name: "small-tokens.txt", sizeBytes: 816_730 },
    ],
    languages: WHISPER_LANGUAGES.length,
    supportedLanguageCodes: WHISPER_LANGUAGES,
  },
  [ModelId.NEMO_PARAKEET_V3]: {
    id: ModelId.NEMO_PARAKEET_V3,
    name: "Parakeet V3",
    description: "High accuracy, high speed",
    sizeBytes: 670_000_000,
    supportedModes: [TranscriptionMode.FILE, TranscriptionMode.REALTIME],
    isBundled: false,
    downloadBaseUrl:
      "https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8/resolve/main",
    sherpaModelType: "nemo_transducer",
    files: [
      { name: "encoder.int8.onnx", sizeBytes: 652_000_000 },
      { name: "decoder.int8.onnx", sizeBytes: 11_800_000 },
      { name: "joiner.int8.onnx", sizeBytes: 6_360_000 },
      { name: "tokens.txt", sizeBytes: 94_000 },
    ],
    languages: 25,
    supportedLanguageCodes: PARAKEET_LANGUAGES,
  },
  [ModelId.QWEN3_ASR]: {
    id: ModelId.QWEN3_ASR,
    name: "Qwen3 ASR",
    description: "High accuracy, 22 Chinese dialects",
    sizeBytes: 982_571_347,
    supportedModes: [TranscriptionMode.FILE],
    isBundled: false,
    downloadBaseUrl:
      "https://huggingface.co/csukuangfj2/sherpa-onnx-qwen3-asr-0.6B-int8-2026-03-25/resolve/main",
    sherpaModelType: "qwen3_asr",
    files: [
      { name: "conv_frontend.onnx", sizeBytes: 44_148_281 },
      { name: "encoder.int8.onnx", sizeBytes: 182_491_662 },
      { name: "decoder.int8.onnx", sizeBytes: 755_914_231 },
      { name: "tokenizer/merges.txt", sizeBytes: 1_671_853 },
      { name: "tokenizer/tokenizer_config.json", sizeBytes: 12_487 },
      { name: "tokenizer/vocab.json", sizeBytes: 2_776_833 },
    ],
    languages: QWEN3_LANGUAGES.length,
    supportedLanguageCodes: QWEN3_LANGUAGES,
  },
};

export const getModelInfo = (modelId: ModelId): ModelInfo =>
  MODEL_REGISTRY[modelId];

export const getAllModels = (): ModelInfo[] => Object.values(MODEL_REGISTRY);

export const getDownloadableModels = (): ModelInfo[] =>
  getAllModels().filter((m) => !m.isBundled);

export const getBundledModels = (): ModelInfo[] =>
  getAllModels().filter((m) => m.isBundled);
