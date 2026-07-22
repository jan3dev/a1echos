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
  parseConfusables,
  contextualContraction,
} = require("./decoder");

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
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(fixtures, null, 2) + "\n");
  if (update) {
    fs.writeFileSync(VECTORS_PATH, JSON.stringify(vectors, null, 2) + "\n");
  }
  console.log(
    `Wrote ${fixtures.evaluate.length} evaluate + ${fixtures.nextWords.length} ` +
      `nextWords + ${fixtures.confusables.length} confusable fixtures to ` +
      `${path.relative(process.cwd(), OUTPUT)}` +
      (update ? " (golden vectors updated)" : ""),
  );
}

main();
