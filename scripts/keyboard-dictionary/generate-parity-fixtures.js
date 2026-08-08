"use strict";

/**
 * Runs the golden vectors through the reference decoder against the SHIPPED
 * dictionary and emits `data/keyboard-dictionary/parity-fixtures.json` — the
 * fixture file future Swift (XCTest) and Kotlin (JUnit) parity suites consume
 * to prove the native mirrors match decoder.js.
 *
 * With `--update`, also rewrites the golden vectors' `expect` blocks in place
 * so an intentional engine change becomes a reviewable fixture diff:
 *
 *   node scripts/keyboard-dictionary/generate-parity-fixtures.js [--update]
 */

const fs = require("node:fs");
const path = require("node:path");

const {
  decode,
  evaluate,
  nextWords,
  nextCharWeights,
  parseConfusables,
  contextualContraction,
  TUNING,
} = require("./decoder");
const { makeStubReranker } = require("./lm-stub");

// Prefixes exercising the key-target-resizing signal: deep/shallow trie
// walks, mid-label landings (calenda), apostrophe continuations filtered
// out (can), off-trie prefixes (zz), a typographic apostrophe that must fold
// to ASCII ("can’" — pins decoder.js and the natives to one normalization),
// and mixed case.
const NEXT_CHAR_PREFIXES = [
  "t",
  "th",
  "the",
  "hel",
  "q",
  "a",
  "calenda",
  "can",
  "can’",
  "The",
  "zz",
  "x",
];

const DICTIONARY = path.join(
  __dirname,
  "../../data/keyboard-dictionary/keyboard_dictionary.echd",
);
const CONFUSABLES_PATH = path.join(
  __dirname,
  "../../data/keyboard-dictionary/confusables.json",
);
// (prevWord, nextWord) pairs exercising the confusable table both ways.
const CONFUSABLE_CASES = [
  ["ill", "be"],
  ["ill", "go"],
  ["ill", "call"],
  ["ill", "health"],
  ["ill", "effects"],
  ["id", "like"],
  ["id", "rather"],
  ["id", "guess"],
  ["its", "been"],
  ["its", "a"],
  ["its", "not"],
  ["its", "own"],
  ["its", "going"],
  ["lets", "see"],
  ["lets", "do"],
  ["lets", "go"],
  ["wed", "better"],
  ["hell", "be"],
  ["hell", "yeah"],
  ["shell", "be"],
  ["shell", "out"],
  ["were", "going"],
  ["well", "be"],
  ["Ill", "be"],
  ["shed", "like"],
  ["shed", "light"],
  ["its", "just"],
  ["its", "time"],
  ["ill", "circle"],
  ["wed", "all"],
  ["lets", "sync"],
  ["hell", "know"],
];
// LM-reranker blend vectors: a deterministic stub reranker (context ->
// word -> length-normalized logprob; unknown word -10, unknown context ->
// null i.e. "model unavailable") drives evaluate()'s blend path so all three
// implementations can replay identical neural evidence without a model.
// Stub logprobs are kept >=0.5 apart so Float vs double softmax can't flip
// an ordering. Cases cover: a near-tie flipped by the LM, an LM too weak to
// resurrect a distant candidate, strength 0 (blend is a no-op) and 2, the
// sentence-initial confusable in both directions, and the null fallback.
const LM_RERANK_CASES = [
  {
    typed: "thw",
    prevWord: "to",
    leftContext: "He tried to",
    stub: { "He tried to": { thwart: -0.5, the: -4.0, thaw: -6.0 } },
  },
  {
    typed: "teh",
    prevWord: null,
    leftContext: "Open",
    stub: { Open: { the: -0.5, ten: -5.0, eth: -3.0 } },
  },
  {
    typed: "sata",
    prevWord: "the",
    leftContext: "We grilled the",
    stub: { "We grilled the": { satay: -0.5, saga: -5.0, satan: -6.0 } },
  },
  {
    typed: "thw",
    prevWord: "to",
    leftContext: "He tried to",
    lmStrength: 0,
    stub: { "He tried to": { thwart: -0.5, the: -4.0 } },
  },
  {
    typed: "thw",
    prevWord: "to",
    leftContext: "He tried to",
    lmStrength: 2,
    stub: { "He tried to": { thwart: -0.5, the: -4.0 } },
  },
  {
    typed: "Ill",
    prevWord: null,
    leftContext: "",
    stub: { "": { Ill: -4.0, "I'll": -0.5 } },
  },
  {
    typed: "Ill",
    prevWord: null,
    leftContext: "The doctor said.",
    stub: { "The doctor said.": { Ill: -0.5, "I'll": -4.0 } },
  },
  {
    typed: "Ill",
    prevWord: null,
    leftContext: "context the stub does not know",
    stub: {},
  },
  {
    typed: "helko",
    prevWord: null,
    leftContext: "context the stub does not know",
    stub: {},
  },
];

const VECTORS_PATH = path.join(
  __dirname,
  "__tests__/fixtures/golden-vectors.json",
);
const OUTPUT = path.join(
  __dirname,
  "../../data/keyboard-dictionary/parity-fixtures.json",
);

function main() {
  const update = process.argv.includes("--update");
  const model = decode(fs.readFileSync(DICTIONARY));
  const vectors = JSON.parse(fs.readFileSync(VECTORS_PATH, "utf8"));

  const fixtures = {
    dictionary: path.basename(DICTIONARY),
    evaluate: vectors.evaluate.map((v) => {
      const r = evaluate(model, v.typed, v.prevWord ?? null, {
        touchPoints: v.touches ?? null,
      });
      const expected = {
        candidates: r.candidates,
        topIsCorrection: r.topIsCorrection,
        replacement: r.replacement,
      };
      if (update) v.expect = expected;
      return {
        typed: v.typed,
        prevWord: v.prevWord ?? null,
        touches: v.touches ?? null,
        ...expected,
        verbatim: r.verbatim,
      };
    }),
    nextWords: vectors.nextWords.map((v) => {
      const predictions = nextWords(model, v.prevWord);
      if (update) v.expect = predictions;
      return { prevWord: v.prevWord, predictions };
    }),
    nextCharWeights: NEXT_CHAR_PREFIXES.map((prefix) => ({
      prefix,
      weights: Object.fromEntries(nextCharWeights(model, prefix)),
    })),
    confusables: (() => {
      const table = parseConfusables(
        JSON.parse(fs.readFileSync(CONFUSABLES_PATH, "utf8")),
      );
      return CONFUSABLE_CASES.map(([prev, next]) => ({
        prevWord: prev,
        nextWord: next,
        contraction: contextualContraction(table, prev, next),
      }));
    })(),
    lmRerank: LM_RERANK_CASES.map((c) => {
      const lmStrength = c.lmStrength ?? TUNING.lmStrength;
      const r = evaluate(model, c.typed, c.prevWord ?? null, {
        leftContext: c.leftContext,
        reranker: makeStubReranker(c.stub),
        lmStrength,
      });
      return {
        typed: c.typed,
        prevWord: c.prevWord ?? null,
        leftContext: c.leftContext,
        lmStrength,
        stub: c.stub,
        candidates: r.candidates,
        topIsCorrection: r.topIsCorrection,
        replacement: r.replacement,
        verbatim: r.verbatim,
      };
    }),
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(fixtures, null, 2) + "\n");
  if (update) {
    fs.writeFileSync(VECTORS_PATH, JSON.stringify(vectors, null, 2) + "\n");
  }
  console.log(
    `Wrote ${fixtures.evaluate.length} evaluate + ${fixtures.nextWords.length} ` +
      `nextWords + ${fixtures.confusables.length} confusable + ` +
      `${fixtures.nextCharWeights.length} nextCharWeights + ` +
      `${fixtures.lmRerank.length} lmRerank fixtures to ` +
      `${path.relative(process.cwd(), OUTPUT)}` +
      (update ? " (golden vectors updated)" : ""),
  );
}

main();
