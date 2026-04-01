import { ModelId, TranscriptionMode } from "./ModelType";

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
    languages: 99,
  },
  [ModelId.NEMO_PARAKEET_V3]: {
    id: ModelId.NEMO_PARAKEET_V3,
    name: "Parakeet V3",
    description: "High accuracy, 25 European languages",
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
};

export const getModelInfo = (modelId: ModelId): ModelInfo =>
  MODEL_REGISTRY[modelId];

export const getAllModels = (): ModelInfo[] => Object.values(MODEL_REGISTRY);

export const getDownloadableModels = (): ModelInfo[] =>
  getAllModels().filter((m) => !m.isBundled);

export const getBundledModels = (): ModelInfo[] =>
  getAllModels().filter((m) => m.isBundled);
