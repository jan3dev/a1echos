#!/usr/bin/env node
"use strict";

/**
 * Thin evaluate() helper for scripts/keyboard-lm/bench.py.
 *
 * Reads a JSON document on stdin and prints JSON on stdout. Two modes:
 *
 *   --preview  For each case, run evaluate() with a recording reranker and
 *              return the exact words the engine would ask the LM to score.
 *              Empty `words` means evaluate() never consulted the LM
 *              (contraction / proper-noun / other early return).
 *
 *   --eval     For each case, run evaluate() with a stub reranker populated
 *              by the caller's real length-normalized logprobs (word -> lp).
 *              Missing words score UNKNOWN_WORD_LOGPROB (-10), matching
 *              scripts/keyboard-dictionary/lm-stub.js.
 *
 * Cases that never consult the LM are evaluated with reranker=null so the
 * classical path stays bit-identical.
 */

const fs = require("node:fs");
const path = require("node:path");
const { decode, evaluate } = require("../keyboard-dictionary/decoder");
const { UNKNOWN_WORD_LOGPROB } = require("../keyboard-dictionary/lm-stub");

const DICTIONARY = path.join(
  __dirname,
  "../../data/keyboard-dictionary/keyboard_dictionary.echd",
);

function readInput() {
  const raw = fs.readFileSync(0, "utf8");
  const doc = JSON.parse(raw);
  if (!doc || !Array.isArray(doc.cases)) {
    throw new Error("stdin must be JSON { cases: [...] }");
  }
  return doc.cases;
}

function recordingReranker(seen) {
  return {
    scores(_leftContext, words) {
      for (const w of words) seen.push(w);
      // Abstain so preview doesn't change ranking — we only want the word list.
      return null;
    },
  };
}

function stubReranker(scores) {
  return {
    scores(_leftContext, words) {
      return words.map((w) =>
        Object.prototype.hasOwnProperty.call(scores, w)
          ? scores[w]
          : UNKNOWN_WORD_LOGPROB,
      );
    },
  };
}

function previewCase(model, c) {
  const seen = [];
  evaluate(model, c.typed, c.prevWord ?? null, {
    leftContext: c.leftContext ?? "",
    reranker: recordingReranker(seen),
  });
  return { id: c.id, words: [...new Set(seen)] };
}

function evalCase(model, c) {
  const scores = c.scores && typeof c.scores === "object" ? c.scores : null;
  const hasScores = scores !== null && Object.keys(scores).length > 0;
  const out = evaluate(model, c.typed, c.prevWord ?? null, {
    leftContext: c.leftContext ?? "",
    reranker: hasScores ? stubReranker(scores) : null,
  });
  return {
    id: c.id,
    replacement: out.replacement,
    topIsCorrection: out.topIsCorrection,
    candidates: out.candidates,
  };
}

function loadDictionary(path = DICTIONARY) {
  return decode(fs.readFileSync(path));
}

function main() {
  const mode = process.argv.includes("--preview") ? "preview" : "eval";
  const model = loadDictionary();
  const cases = readInput();
  const results =
    mode === "preview"
      ? cases.map((c) => previewCase(model, c))
      : cases.map((c) => evalCase(model, c));
  process.stdout.write(JSON.stringify({ results }) + "\n");
}

if (require.main === module) {
  main();
}

module.exports = {
  previewCase,
  evalCase,
  loadDictionary,
  DICTIONARY,
};
