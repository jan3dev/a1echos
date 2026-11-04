import { getBackendDevicesInfo, initLlama } from "llama.rn";
import { Platform } from "react-native";

import { LlmModelId } from "@/models";

import { modelDownloadService } from "../model-download-service/ModelDownloadService";

import {
  dropRepeatedLines,
  llmService,
  trailingRepeats,
  visibleText,
} from "./LlmService";
import PROMPTS from "./prompts.json";

jest.mock("llama.rn", () => ({
  getBackendDevicesInfo: jest.fn(),
  initLlama: jest.fn(),
}));

jest.mock("../model-download-service/ModelDownloadService", () => ({
  modelDownloadService: { getModelPath: jest.fn() },
}));

const mockContext = () => ({
  tokenize: jest.fn(async (text: string) => ({
    tokens: text.split(" "),
    has_media: false,
  })),
  stopCompletion: jest.fn().mockResolvedValue(undefined),
  completion: jest.fn(async (_params, onToken) => {
    for (const token of ["<think>", "\n\n", "</think>", "\n\n- Ship"]) {
      onToken?.({ token });
    }
    return mockResult;
  }),
  release: jest.fn().mockResolvedValue(undefined),
});

const mockResult = {
  content: "<think>\n\n</think>\n\n- Ship on Wednesday.\n",
  stopped_limit: 0,
  timings: {
    prompt_n: 120,
    prompt_per_second: 400,
    predicted_n: 30,
    predicted_per_second: 25,
  },
};

describe("llmService", () => {
  beforeEach(async () => {
    await llmService.release();
    jest.clearAllMocks();
    (modelDownloadService.getModelPath as jest.Mock).mockReturnValue(
      "file:///docs/models/qwen35_2b",
    );
    (initLlama as jest.Mock).mockImplementation(async () => mockContext());
  });

  it("reports the CPU device's memory as total RAM", async () => {
    (getBackendDevicesInfo as jest.Mock).mockResolvedValue([
      { type: "gpu", maxMemorySize: 5e9 },
      { type: "cpu", maxMemorySize: 8e9 },
    ]);
    await expect(llmService.getTotalRamBytes()).resolves.toBe(8e9);

    (getBackendDevicesInfo as jest.Mock).mockResolvedValue([]);
    await expect(llmService.getTotalRamBytes()).resolves.toBeNull();
  });

  it("refuses to load a model that isn't downloaded", async () => {
    (modelDownloadService.getModelPath as jest.Mock).mockReturnValue(null);
    await expect(llmService.load(LlmModelId.QWEN35_2B)).rejects.toThrow(
      "not downloaded",
    );
    expect(initLlama).not.toHaveBeenCalled();
  });

  it("loads the GGUF once and reuses it", async () => {
    await llmService.load(LlmModelId.QWEN35_2B, { gpu: false });
    expect(initLlama).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "file:///docs/models/qwen35_2b/Qwen3.5-2B-Q4_K_M.gguf",
        n_gpu_layers: 0,
      }),
    );
    await expect(
      llmService.load(LlmModelId.QWEN35_2B, { gpu: false }),
    ).resolves.toBe(0);
    expect(initLlama).toHaveBeenCalledTimes(1);
  });

  it("releases the previous context when switching model or GPU mode", async () => {
    await llmService.load(LlmModelId.QWEN35_2B, { gpu: false });
    const first = (initLlama as jest.Mock).mock.results[0].value;
    await llmService.load(LlmModelId.QWEN35_2B, { gpu: true });
    expect((await first).release).toHaveBeenCalled();
    expect(initLlama).toHaveBeenLastCalledWith(
      expect.objectContaining({ n_gpu_layers: 99 }),
    );
  });

  it("defaults GPU offload to iOS only", async () => {
    await llmService.load(LlmModelId.QWEN35_2B);
    expect(initLlama).toHaveBeenLastCalledWith(
      expect.objectContaining({
        n_gpu_layers: Platform.OS === "ios" ? 99 : 0,
      }),
    );
  });

  it("runs a task with the shipped prompt and thinking disabled", async () => {
    const result = await llmService.run(
      LlmModelId.QWEN35_2B,
      "summary",
      "we ship on wednesday",
    );
    const context = await (initLlama as jest.Mock).mock.results[0].value;
    expect(context.completion).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: "system", content: PROMPTS.summary },
          { role: "user", content: "we ship on wednesday" },
        ],
        temperature: 0,
        enable_thinking: false,
      }),
      expect.any(Function),
    );
    expect(result).toEqual({
      text: "- Ship on Wednesday.",
      promptTokens: 120,
      promptTokensPerSecond: 400,
      tokensPerSecond: 25,
    });
  });

  it("reloads when the context size changes and disables weight repacking", async () => {
    await llmService.load(LlmModelId.QWEN35_2B, { gpu: false });
    expect(initLlama).toHaveBeenLastCalledWith(
      expect.objectContaining({ n_ctx: 8192, no_extra_bufts: true }),
    );
    await llmService.load(LlmModelId.QWEN35_2B, {
      gpu: false,
      contextTokens: 16384,
    });
    expect(initLlama).toHaveBeenCalledTimes(2);
    expect(initLlama).toHaveBeenLastCalledWith(
      expect.objectContaining({ n_ctx: 16384 }),
    );
  });

  it("leaves room for the prompt and output in the input budget", () => {
    expect(llmService.inputBudget(LlmModelId.QWEN35_2B)).toBe(8192 - 1536);
    expect(llmService.inputBudget(LlmModelId.QWEN35_2B, 16384)).toBe(
      16384 - 1536,
    );
  });

  it("reserves at least 3k and allows up to 4k tokens for the final summary", () => {
    const id = LlmModelId.QWEN35_2B;
    const finalInput = llmService.finalInputBudget(id);
    expect(finalInput).toBe(8192 - 512 - 3072);
    expect(llmService.finalOutputTokens(id, finalInput)).toBe(3072);
    expect(llmService.finalOutputTokens(id, 100)).toBe(4096);
  });

  it("caps chunk passes at 1k output unless told otherwise", async () => {
    await llmService.run(LlmModelId.QWEN35_2B, "summary", "a");
    await llmService.run(LlmModelId.QWEN35_2B, "merge", "b", {
      maxOutputTokens: 4096,
    });
    const context = await (initLlama as jest.Mock).mock.results[0].value;
    expect(
      context.completion.mock.calls.map(([p]: any) => p.n_predict),
    ).toEqual([1024, 4096]);
  });

  it("counts tokens with the loaded model", async () => {
    await expect(
      llmService.countTokens(LlmModelId.QWEN35_2B, "one two three"),
    ).resolves.toBe(3);
  });

  it("streams visible text without the prefilled think block", async () => {
    const onText = jest.fn();
    await llmService.run(LlmModelId.QWEN35_2B, "summary", "text", { onText });
    expect(onText.mock.calls.map(([t]) => t)).toEqual(["", "", "", "- Ship"]);
  });

  it("stops the running completion, and is a no-op with nothing loaded", async () => {
    await expect(llmService.stop()).resolves.toBeUndefined();
    await llmService.load(LlmModelId.QWEN35_2B);
    await llmService.stop();
    const context = await (initLlama as jest.Mock).mock.results[0].value;
    expect(context.stopCompletion).toHaveBeenCalled();
  });

  it("skips the completion when cancelled during the load", async () => {
    const result = await llmService.run(LlmModelId.QWEN35_2B, "summary", "x", {
      isCancelled: () => true,
    });
    const context = await (initLlama as jest.Mock).mock.results[0].value;
    expect(context.completion).not.toHaveBeenCalled();
    expect(result.text).toBe("");
  });

  it("re-sends the stop on the first token after a cancel", async () => {
    let cancelled = false;
    const done = llmService.run(LlmModelId.QWEN35_2B, "summary", "x", {
      isCancelled: () => cancelled,
      onText: () => (cancelled = true),
    });
    await done;
    const context = await (initLlama as jest.Mock).mock.results[0].value;
    expect(context.stopCompletion).toHaveBeenCalledTimes(1);
  });

  it("waits for the previous model's release before loading the next", async () => {
    await llmService.load(LlmModelId.QWEN35_2B);
    const first = await (initLlama as jest.Mock).mock.results[0].value;
    let freed!: () => void;
    first.release.mockReturnValueOnce(new Promise<void>((r) => (freed = r)));
    void llmService.release();
    const next = llmService.load(LlmModelId.QWEN35_0_8B);
    await Promise.resolve();
    expect(initLlama).toHaveBeenCalledTimes(1);
    freed();
    await next;
    expect(initLlama).toHaveBeenCalledTimes(2);
  });

  it("stops a completion that loops on the same lines and drops the repeats", async () => {
    const context = mockContext();
    let stopped = false;
    // Like the native JSI call: returns undefined, not a promise.
    context.stopCompletion.mockImplementation(() => {
      stopped = true;
    });
    context.completion.mockImplementation(async (_params, onToken) => {
      let content = "- Intro\n";
      onToken({ token: content });
      for (let i = 0; i < 50 && !stopped; i++) {
        const token = i % 2 ? "- B\n" : "- A\n";
        content += token;
        onToken({ token });
      }
      // Like native: a stopped completion has raw `text` but no `content`.
      return { ...mockResult, content: undefined, text: content } as any;
    });
    (initLlama as jest.Mock).mockResolvedValueOnce(context);
    const onText = jest.fn();

    const result = await llmService.run(LlmModelId.QWEN35_2B, "merge", "x", {
      onText,
    });

    expect(context.stopCompletion).toHaveBeenCalledTimes(1);
    // Stopped on the third repeated line: A B A B A.
    expect(onText).toHaveBeenCalledTimes(6);
    expect(onText).toHaveBeenLastCalledWith("- Intro\n- A\n- B");
    expect(result.text).toBe("- Intro\n- A\n- B");
  });

  it.each([
    ["- A\n- B\n- A\n", 1],
    ["- A\n- B\n- A\n- B", 1],
    ["- A\n\n- A\n- A\n- C\n", 0],
    ["- A\n- A\n- A\n- A\n", 3],
  ])("trailingRepeats(%j) is %i", (text, expected) => {
    expect(trailingRepeats(text)).toBe(expected);
  });

  it("drops repeated lines but keeps paragraph breaks", () => {
    expect(dropRepeatedLines("- A\n\n- B\n- A\n\n\n- C\n- B")).toBe(
      "- A\n\n- B\n\n- C",
    );
  });

  it.each([
    ["<think>\n\n</think>\n\n- A", "- A"],
    ["<think>still thinking", ""],
    ["  - Plain  ", "- Plain"],
  ])("visibleText(%j) is %j", (raw, expected) => {
    expect(visibleText(raw)).toBe(expected);
  });
});
