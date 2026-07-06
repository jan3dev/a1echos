"use strict";

/**
 * Compiles the ECHD keyboard dictionary binary from the vendored sources.
 *
 *   node scripts/keyboard-dictionary/build.js
 *
 * The output (data/keyboard-dictionary/keyboard_dictionary.echd) is committed;
 * a jest roundtrip test asserts the committed artifact matches a fresh encode
 * so the two cannot drift.
 */

const fs = require("node:fs");
const path = require("node:path");
const { encode } = require("./encoder");

const DATA_DIR = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "keyboard-dictionary",
);
const OUTPUT = path.join(DATA_DIR, "keyboard_dictionary.echd");

function readSources() {
  return {
    unigramText:
      fs.readFileSync(
        path.join(DATA_DIR, "frequency_dictionary_en_82_765.txt"),
        "utf8",
      ) +
      "\n" +
      // Modern/informal vocabulary SCOWL lacks (ok, lol, wifi, bitcoin, ...);
      // without these autocorrect would mangle them.
      fs.readFileSync(path.join(DATA_DIR, "extra_words.txt"), "utf8"),
    bigramText: fs.readFileSync(
      path.join(DATA_DIR, "frequency_bigramdictionary_en_243_342.txt"),
      "utf8",
    ),
    contractions: JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "contractions.json"), "utf8"),
    ),
    neverCorrectTo: fs
      .readFileSync(path.join(DATA_DIR, "never_correct_to.txt"), "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    properNouns: fs
      .readFileSync(path.join(DATA_DIR, "proper_nouns.txt"), "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  };
}

function main() {
  const buffer = encode(readSources());
  fs.writeFileSync(OUTPUT, buffer);
  const mb = (buffer.length / (1024 * 1024)).toFixed(2);
  console.log(`Wrote ${OUTPUT} (${buffer.length} bytes, ${mb} MB)`);
}

if (require.main === module) main();

module.exports = { readSources, OUTPUT, DATA_DIR };
