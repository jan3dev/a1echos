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

const HEADING = /[:：]\s*$/;
const MARKDOWN_HEADING = /^\s*#+\s+(.+?)[:：]?\s*$/;
const indent = (line: string) => line.search(/\S/);
const words = (line: string) =>
  line.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const pairs = (w: string[]) => w.slice(1).map((x, i) => `${w[i]} ${x}`);
const share = (items: string[], seen: Set<string>) =>
  items.filter((x) => seen.has(x)).length / items.length;
// A word longer than "is"/"of" the notes haven't had yet.
const addsWord = (w: string[], seen: Set<string>) =>
  w.some((x) => x.length > 2 && !seen.has(x));
// Most of its words, and every number, are in that one line.
const restates = (w: string[], line: Set<string>) =>
  share(w, line) >= 0.8 && w.every((x) => line.has(x) || !/\d/.test(x));

const throwIfCancelled = (deps: { isCancelled: () => boolean }) => {
  if (deps.isCancelled()) throw new SummaryCancelledError();
};

/**
 * Small models restate notes they've already written, under another heading
 * or as a closing recap, sometimes until the token cap. Drops a point that
 * repeats earlier ones (≥80% of its words in one earlier line, or of its word
 * pairs anywhere earlier) without adding a word or number, then headings
 * left without points. Also strips the markdown they add despite the prompt:
 * notes are plain text.
 */
export const dropRestatedNotes = (text: string): string => {
  const keys = new Set<string>();
  const lines: Set<string>[] = [];
  const seenPairs = new Set<string>();
  const seenWords = new Set<string>();
  const kept: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\*\*/g, "").replace(MARKDOWN_HEADING, "$1:");
    const w = words(line);
    if (w.length && !HEADING.test(line)) {
      const key = w.join(" ");
      const repeats =
        !addsWord(w, seenWords) &&
        (keys.has(key) ||
          (w.length >= 3 && lines.some((seen) => restates(w, seen))) ||
          (w.length >= 4 && share(pairs(w), seenPairs) >= 0.8));
      if (repeats) continue;
      keys.add(key);
      lines.push(new Set(w));
      for (const pair of pairs(w)) seenPairs.add(pair);
    }
    for (const x of w) seenWords.add(x);
    kept.push(line.trimEnd());
  }
  const isOrphan = (i: number) => {
    const next = kept.slice(i + 1).find((l) => l.trim());
    return !next || (HEADING.test(next) && indent(next) <= indent(kept[i]));
  };
  return kept
    .filter((l, i) => !HEADING.test(l) || !isOrphan(i))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export type StructureDeps = Pick<
  SummarizeDeps,
  "budget" | "finalOutputTokens" | "countTokens" | "complete" | "isCancelled"
>;

// Notes measured up to 1.8x their input (Japanese); past 2x the model is
// looping, which takes minutes on a phone.
const notesOutputTokens = (tokens: number) => tokens * 2 + 128;

/** Formats text of any length into notes, piece by piece: unlike a summary,
 *  the output is about as long as the input, so it can't be merged down. */
export const structure = async (
  text: string,
  deps: StructureDeps,
): Promise<string> => {
  // Chunks small enough that their notes fit under the output cap.
  const chunkSize = Math.min(
    deps.budget,
    Math.floor((deps.finalOutputTokens(0) - notesOutputTokens(0)) / 2),
  );
  const notes: string[] = [];
  for (const chunk of await splitByTokens(
    text.trim(),
    chunkSize,
    deps.countTokens,
  )) {
    throwIfCancelled(deps);
    const tokens = await deps.countTokens(chunk);
    notes.push(
      await deps.complete("structure", chunk, {
        maxOutputTokens: Math.min(
          deps.finalOutputTokens(tokens),
          notesOutputTokens(tokens),
        ),
      }),
    );
  }
  throwIfCancelled(deps);
  return dropRestatedNotes(notes.filter(Boolean).join("\n\n"));
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
  let task: LlmTask = "summary";
  let input = text.trim();
  for (let round = 0; round < MAX_ROUNDS; round++) {
    throwIfCancelled(deps);
    const tokens = await deps.countTokens(input);
    if (tokens <= deps.finalBudget) {
      const summary = await deps.complete(task, input, {
        onText: deps.onText,
        maxOutputTokens: deps.finalOutputTokens(tokens),
      });
      throwIfCancelled(deps);
      return summary;
    }
    // Text that would fit one chunk still splits in two: a single chunk pass
    // would squeeze it into the short chunk output.
    const chunkSize = Math.min(deps.budget, Math.ceil(tokens / 2));
    const chunks = await splitByTokens(input, chunkSize, deps.countTokens);
    const partials: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      throwIfCancelled(deps);
      deps.onProgress?.(i + 1, chunks.length);
      partials.push(await deps.complete(task, chunks[i]));
    }
    throwIfCancelled(deps);
    input = partials.filter(Boolean).join("\n\n");
    if (!input) return "";
    task = "merge";
  }
  throw new Error("Summary did not converge");
};
