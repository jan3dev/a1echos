import type { LlmTask } from "./LlmService";

export interface SummarizeDeps {
  /** Input tokens a chunk pass can take (its output is short). */
  budget: number;
  /** Input tokens the final pass can take and still write a long summary. */
  finalBudget: number;
  /** Output tokens the final pass may write for `inputTokens` of input. */
  finalOutputTokens: (inputTokens: number) => number;
  countTokens: (text: string) => Promise<number>;
  /** Without `maxOutputTokens`, the model's chunk-pass cap applies. */
  complete: (
    task: LlmTask,
    text: string,
    options?: {
      onText?: (text: string) => void;
      maxOutputTokens?: number;
    },
  ) => Promise<string>;
  isCancelled: () => boolean;
  /** Chunk being summarized (1-based) of how many in this round. */
  onProgress?: (part: number, parts: number) => void;
  /** Streams the final pass only. */
  onText?: (text: string) => void;
}

export class SummaryCancelledError extends Error {
  constructor() {
    super("Summary cancelled");
  }
}

// Each round shrinks the text ~5x (≤1k output per ~6.6k-token chunk), so
// this covers far more speech than a session holds.
const MAX_ROUNDS = 4;

/** Sentences, keeping their punctuation and trailing space; CJK and Arabic
 *  enders too, since ASR output may have no spaces between sentences. */
const SENTENCE = /[^.!?。！？؟\n]*[.!?。！？؟]+\s*|[^.!?。！？؟\n]+\s*|\n+/g;

/** Splits `text` into pieces of at most `budget` tokens, cutting at
 *  paragraphs, then sentences, then (for unpunctuated runs) characters. */
export const splitByTokens = async (
  text: string,
  budget: number,
  countTokens: (text: string) => Promise<number>,
): Promise<string[]> => {
  const units: { text: string; tokens: number }[] = [];
  for (const sentence of text.match(SENTENCE) ?? []) {
    const tokens = await countTokens(sentence);
    if (tokens <= budget) {
      units.push({ text: sentence, tokens });
      continue;
    }
    // Pieces sized by this sentence's own chars-per-token, with 10% slack.
    const pieces = Math.ceil((tokens / budget) * 1.1);
    const size = Math.ceil(sentence.length / pieces);
    for (let i = 0; i < sentence.length; i += size) {
      const piece = sentence.slice(i, i + size);
      units.push({ text: piece, tokens: await countTokens(piece) });
    }
  }

  const chunks: string[] = [];
  let current = "";
  let currentTokens = 0;
  for (const unit of units) {
    // Token counts don't add exactly across a join; the 5% keeps it safe.
    if (current && (currentTokens + unit.tokens) * 1.05 > budget) {
      chunks.push(current.trim());
      current = "";
      currentTokens = 0;
    }
    current += unit.text;
    currentTokens += unit.tokens;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
};

/**
 * Summarizes text of any length: one pass when it fits the context with room
 * for a long summary, otherwise map-reduce: summarize each chunk, then merge
 * the partial summaries, in as many rounds as it takes.
 */
export const summarize = async (
  text: string,
  deps: SummarizeDeps,
): Promise<string> => {
  const check = () => {
    if (deps.isCancelled()) throw new SummaryCancelledError();
  };

  let task: LlmTask = "summary";
  let input = text.trim();
  for (let round = 0; round < MAX_ROUNDS; round++) {
    check();
    const tokens = await deps.countTokens(input);
    if (tokens <= deps.finalBudget) {
      const summary = await deps.complete(task, input, {
        onText: deps.onText,
        maxOutputTokens: deps.finalOutputTokens(tokens),
      });
      check();
      return summary;
    }
    // Text that would fit one chunk still splits in two: a single chunk pass
    // would squeeze it into the short chunk output.
    const chunkSize = Math.min(deps.budget, Math.ceil(tokens / 2));
    const chunks = await splitByTokens(input, chunkSize, deps.countTokens);
    const partials: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      check();
      deps.onProgress?.(i + 1, chunks.length);
      partials.push(await deps.complete(task, chunks[i]));
    }
    check();
    input = partials.filter(Boolean).join("\n\n");
    if (!input) return "";
    task = "merge";
  }
  throw new Error("Summary did not converge");
};
