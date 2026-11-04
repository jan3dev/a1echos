import { LlmModelId, ModelId } from "../model-type/ModelType";

import {
  MODEL_REGISTRY,
  type ModelFileInfo,
  type ModelInfo,
} from "./ModelRegistry";

export interface LlmModelInfo {
  id: LlmModelId;
  name: string;
  sizeBytes: number;
  isBundled: boolean;
  /** Pinned to a commit so the GGUF can't change under a released build. */
  downloadBaseUrl: string;
  /** A single GGUF; llama.cpp opens it by path. */
  files: [ModelFileInfo];
  /** Total device RAM (as the OS reports it, below the marketed size) from
   *  which this is the recommended model. */
  minRamBytes: number;
  /** n_ctx per load. Qwen3.5 caches only 6 of 24 layers per token (12 KiB;
   *  32 KiB for 4B), so this is mostly about prompt-processing time.
   *  Longer sessions are summarized in chunks. */
  contextTokens: number;
  /** Vocabulary pruned to English: other languages come out garbled. */
  englishOnly?: boolean;
}

const hf = (repo: string, commit: string) =>
  `https://huggingface.co/${repo}/resolve/${commit}`;

// Candidates under evaluation: scripts/llm-summary/bench.js scores the same
// GGUFs. All Apache-2.0 and ungated, so anonymous downloads work.
export const LLM_REGISTRY: Record<LlmModelId, LlmModelInfo> = {
  // The 0.8B with the vocabulary rows English never uses dropped
  // (scripts/llm-english). Listed first so the full 0.8B wins the RAM tie.
  [LlmModelId.QWEN35_0_8B_EN]: {
    id: LlmModelId.QWEN35_0_8B_EN,
    name: "Qwen3.5 0.8B English",
    sizeBytes: 376_494_464,
    isBundled: false,
    downloadBaseUrl: hf("jan3com/Qwen3.5-0.8B-English-GGUF", "d374efe92d37a3e29c3b9f36ec0cb0ded0ffe0df"),
    files: [{ name: "Qwen3.5-0.8B-English-Q4_K_M.gguf", sizeBytes: 376_494_464 }],
    minRamBytes: 0,
    contextTokens: 8192,
    englishOnly: true,
  },
  [LlmModelId.QWEN35_0_8B]: {
    id: LlmModelId.QWEN35_0_8B,
    name: "Qwen3.5 0.8B",
    sizeBytes: 532_517_120,
    isBundled: false,
    downloadBaseUrl: hf(
      "unsloth/Qwen3.5-0.8B-GGUF",
      "6ab461498e2023f6e3c1baea90a8f0fe38ab64d0",
    ),
    files: [{ name: "Qwen3.5-0.8B-Q4_K_M.gguf", sizeBytes: 532_517_120 }],
    minRamBytes: 0,
    contextTokens: 8192,
  },
  [LlmModelId.QWEN35_2B]: {
    id: LlmModelId.QWEN35_2B,
    name: "Qwen3.5 2B",
    sizeBytes: 1_280_835_840,
    isBundled: false,
    downloadBaseUrl: hf(
      "unsloth/Qwen3.5-2B-GGUF",
      "f6d5376be1edb4d416d56da11e5397a961aca8ae",
    ),
    files: [{ name: "Qwen3.5-2B-Q4_K_M.gguf", sizeBytes: 1_280_835_840 }],
    minRamBytes: 5_000_000_000,
    contextTokens: 8192,
  },
  [LlmModelId.QWEN35_4B]: {
    id: LlmModelId.QWEN35_4B,
    name: "Qwen3.5 4B",
    sizeBytes: 2_583_221_408,
    isBundled: false,
    downloadBaseUrl: hf(
      "unsloth/Qwen3.5-4B-GGUF",
      "e87f176479d0855a907a41277aca2f8ee7a09523",
    ),
    files: [{ name: "Qwen3.5-4B-Q4_0.gguf", sizeBytes: 2_583_221_408 }],
    minRamBytes: 7_000_000_000,
    contextTokens: 8192,
  },
};

export const getLlmInfo = (id: LlmModelId): LlmModelInfo => LLM_REGISTRY[id];

const ALL_LLMS: LlmModelInfo[] = Object.values(LLM_REGISTRY);

export const getAllLlms = (): LlmModelInfo[] => ALL_LLMS;

// ponytail: RAM tiers are a first guess (4 GB → 0.8B, 6 GB → 2B, 8 GB+ → 4B);
// tune minRamBytes from the on-device bench (app/(dev)/llm-bench.tsx).
/** The largest model the device has the RAM for. */
export const getRecommendedLlmId = (totalRamBytes: number): LlmModelId =>
  ALL_LLMS.reduce((best, llm) =>
    totalRamBytes >= llm.minRamBytes && llm.minRamBytes >= best.minRamBytes
      ? llm
      : best,
  ).id;

/** Everything the model download service and store manage: ASR models and LLMs. */
export type DownloadableModelId = ModelId | LlmModelId;

const DOWNLOADABLE: Record<DownloadableModelId, ModelInfo | LlmModelInfo> = {
  ...MODEL_REGISTRY,
  ...LLM_REGISTRY,
};

export const getDownloadableModel = (id: DownloadableModelId) =>
  DOWNLOADABLE[id];

const ALL_DOWNLOADABLE = Object.values(DOWNLOADABLE);

export const getAllDownloadableModels = () => ALL_DOWNLOADABLE;
