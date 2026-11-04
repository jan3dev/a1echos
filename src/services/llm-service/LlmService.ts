import { getBackendDevicesInfo, initLlama, type LlamaContext } from "llama.rn";
import { Platform } from "react-native";

import { getLlmInfo, type LlmModelId } from "@/models";

import { modelDownloadService } from "../model-download-service/ModelDownloadService";

import PROMPTS from "./prompts.json";

export type LlmTask = keyof typeof PROMPTS;

export interface LlmLoadOptions {
  /** Offload layers to the GPU (Metal on iOS, OpenCL on Adreno Android). */
  gpu?: boolean;
  /** n_ctx; defaults to the model's registry value. */
  contextTokens?: number;
}

export interface LlmRunOptions extends LlmLoadOptions {
  /** Called with the visible output so far, after every token. */
  onText?: (text: string) => void;
  /** n_predict; defaults to the chunk-pass cap. */
  maxOutputTokens?: number;
  /** Polled after the load and on every token. A stop() sent before the
   *  completion starts is lost (llama.rn resets the interrupt flag). */
  isCancelled?: () => boolean;
}

export interface LlmResult {
  text: string;
  promptTokens: number;
  promptTokensPerSecond: number;
  tokensPerSecond: number;
}

// Chunk summaries stay short so every merge round shrinks the text.
const CHUNK_OUTPUT_TOKENS = 1024;
// The final summary is what the user reads: give it room for long sessions,
// within a ceiling that bounds a runaway (repeating) generation.
const FINAL_OUTPUT_TOKENS = { min: 3072, max: 4096 };
// System prompt (~100 tokens) plus chat template, with headroom.
const PROMPT_RESERVE_TOKENS = 512;

// llama.rn returns the template's prefilled "<think>\n\n</think>" too; while
// streaming, an unclosed block hides everything after it.
const THINK_BLOCK = /^\s*<think>[\s\S]*?(<\/think>|$)/;
export const visibleText = (raw: string): string =>
  raw.replace(THINK_BLOCK, "").trim();

// Small models at temperature 0 can loop on a block of lines until the token
// cap (minutes on a throttled phone). A summary never repeats a line verbatim.
const REPEATED_LINES_TO_STOP = 3;

/** How many complete lines in a row at the end repeat an earlier line. */
export const trailingRepeats = (text: string): number => {
  const seen = new Set<string>();
  let run = 0;
  for (const line of text.split("\n").slice(0, -1)) {
    const key = line.trim();
    if (!key) continue;
    if (seen.has(key)) run++;
    else {
      run = 0;
      seen.add(key);
    }
  }
  return run;
};

export const dropRepeatedLines = (text: string): string => {
  const seen = new Set<string>();
  return text
    .split("\n")
    .filter((line) => {
      const key = line.trim();
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const createLlmService = () => {
  let loaded: {
    id: LlmModelId;
    gpu: boolean;
    contextTokens: number;
    context: LlamaContext;
  } | null = null;

  /** Physical RAM as the CPU backend reports it, or null if unavailable. */
  const getTotalRamBytes = async (): Promise<number | null> => {
    const devices = await getBackendDevicesInfo();
    return devices.find((d) => d.type === "cpu")?.maxMemorySize ?? null;
  };

  // The next load waits for this, so two models are never resident at once.
  let releasing: Promise<void> = Promise.resolve();

  const release = (): Promise<void> => {
    const current = loaded;
    loaded = null;
    if (!current) return releasing;
    const pending = current.context.release();
    releasing = pending.catch(() => {});
    return pending;
  };

  /** Loads the model (releasing any other one) and returns the load time in
   *  ms, or 0 when it was already loaded. */
  const load = async (
    id: LlmModelId,
    {
      gpu = Platform.OS === "ios",
      contextTokens = getLlmInfo(id).contextTokens,
    }: LlmLoadOptions = {},
  ): Promise<number> => {
    if (
      loaded?.id === id &&
      loaded.gpu === gpu &&
      loaded.contextTokens === contextTokens
    ) {
      return 0;
    }
    const dir = modelDownloadService.getModelPath(id);
    if (!dir) throw new Error(`LLM not downloaded: ${id}`);

    await release();
    const started = Date.now();
    const context = await initLlama({
      model: `${dir}/${getLlmInfo(id).files[0].name}`,
      n_ctx: contextTokens,
      n_gpu_layers: gpu ? 99 : 0,
      use_mlock: false,
      // CPU weight repacking keeps a second, dirty copy of the weights
      // (+1.2 GB for 2B) for no gain on Q4_K; measured in bench.
      no_extra_bufts: true,
    });
    loaded = { id, gpu, contextTokens, context };
    return Date.now() - started;
  };

  const usableContext = (id: LlmModelId, contextTokens?: number) =>
    (contextTokens ?? getLlmInfo(id).contextTokens) - PROMPT_RESERVE_TOKENS;

  /** Input tokens a chunk pass can take, leaving room for its output. */
  const inputBudget = (id: LlmModelId, contextTokens?: number): number =>
    usableContext(id, contextTokens) - CHUNK_OUTPUT_TOKENS;

  /** Input tokens the final pass can take and still write a long summary. */
  const finalInputBudget = (id: LlmModelId, contextTokens?: number): number =>
    usableContext(id, contextTokens) - FINAL_OUTPUT_TOKENS.min;

  /** What the final pass may write for `inputTokens` of input. */
  const finalOutputTokens = (
    id: LlmModelId,
    inputTokens: number,
    contextTokens?: number,
  ): number =>
    Math.min(
      FINAL_OUTPUT_TOKENS.max,
      usableContext(id, contextTokens) - inputTokens,
    );

  const countTokens = async (
    id: LlmModelId,
    text: string,
    options?: LlmLoadOptions,
  ): Promise<number> => {
    await load(id, options);
    return (await loaded!.context.tokenize(text)).tokens.length;
  };

  const run = async (
    id: LlmModelId,
    task: LlmTask,
    transcript: string,
    {
      onText,
      maxOutputTokens = CHUNK_OUTPUT_TOKENS,
      isCancelled,
      ...options
    }: LlmRunOptions = {},
  ): Promise<LlmResult> => {
    await load(id, options);
    if (isCancelled?.()) {
      return {
        text: "",
        promptTokens: 0,
        promptTokensPerSecond: 0,
        tokensPerSecond: 0,
      };
    }
    const { context } = loaded!;
    let raw = "";
    let stopping = false;
    const result = await context.completion(
      {
        messages: [
          { role: "system", content: PROMPTS[task] },
          { role: "user", content: transcript },
        ],
        n_predict: maxOutputTokens,
        temperature: 0,
        // Qwen3.5 4B thinks by default; summaries don't need it.
        enable_thinking: false,
      },
      (data) => {
        raw += data.token;
        if (
          !stopping &&
          (isCancelled?.() ||
            (data.token.includes("\n") &&
              trailingRepeats(raw) >= REPEATED_LINES_TO_STOP))
        ) {
          stopping = true;
          stop().catch(() => {});
        }
        onText?.(dropRepeatedLines(visibleText(raw)));
      },
    );
    return {
      // Native leaves `content` unset on a stopped completion; `text` is raw.
      text: dropRepeatedLines(visibleText(result.content ?? result.text)),
      promptTokens: result.timings.prompt_n,
      promptTokensPerSecond: result.timings.prompt_per_second,
      tokensPerSecond: result.timings.predicted_per_second,
    };
  };

  /** Ends the running completion early; `run` resolves with what it has.
   *  Async on purpose: the native call returns undefined despite its type. */
  const stop = async (): Promise<void> => {
    await loaded?.context.stopCompletion();
  };

  return {
    getTotalRamBytes,
    load,
    inputBudget,
    finalInputBudget,
    finalOutputTokens,
    countTokens,
    run,
    stop,
    release,
  };
};

export const llmService = createLlmService();
