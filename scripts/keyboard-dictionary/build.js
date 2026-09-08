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
const zlib = require("node:zlib");
const { encode, parseUnigrams } = require("./encoder");

const DATA_DIR = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "keyboard-dictionary",
);
const OUTPUT = path.join(DATA_DIR, "keyboard_dictionary.echd");

/**
 * The forced-replacement table: apostrophe contractions (im -> "I'm") plus
 * valid-but-almost-never-intended words (calender, wether, loosing, payed).
 * Both share one runtime path — the typed form is deleted from the unigram set
 * and always corrected, and a revert blacklists the pair.
 *
 * A general "valid-but-rare" override was evaluated and rejected: with a
 * 1-byte quantized unigram and top-100k bigram table, every frequency-gap
 * threshold that admits calender->calendar also admits brandy->brand,
 * facet->fact and chirp->chip, and common previous words ("the", "a") provide
 * bigram support for all of them.
 *
 * The two kinds stay distinguishable at runtime by apostrophe, which
 * `decoder.js splitContraction` relies on to keep forced corrections out of
 * the self-evident word-split path. Asserted here so the encoding cannot
 * silently drift.
 */
function readForcedReplacements() {
  const read = (name) =>
    JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
  const contractions = read("contractions.json");
  const forced = read("forced_corrections.json");

  for (const [typed, expansion] of Object.entries(contractions)) {
    if (!expansion.includes("'")) {
      throw new Error(
        `contractions.json: "${typed}" -> "${expansion}" has no apostrophe; ` +
          "wordSplits would treat it as a self-evident split half. Move it " +
          "to forced_corrections.json.",
      );
    }
  }
  for (const [typed, expansion] of Object.entries(forced)) {
    if (expansion.includes("'")) {
      throw new Error(
        `forced_corrections.json: "${typed}" -> "${expansion}" contains an ` +
          "apostrophe; move it to contractions.json.",
      );
    }
    if (typed in contractions) {
      throw new Error(
        `forced_corrections.json: "${typed}" also in contractions.json.`,
      );
    }
  }
  return { ...contractions, ...forced };
}

/**
 * The AOSP LatinIME en_US keyboard dictionary (Apache-2.0, see
 * LICENSE-aosp-latinime.md), folded onto the SymSpell frequency scale. The
 * SymSpell list is Google-Books English with a British slant: it lacks about
 * half of the American spellings (favorite, theater, mom, neighbor, canceled)
 * and 40k more everyday inflections, so on Android — which has no system
 * spell-checker veto — those valid words were autocorrected into their UK
 * twins. Every lowercase alphabetic AOSP entry becomes a valid word here.
 *
 * AOSP's `f` byte is mapped to our quantized byte with q = 1.3·f − 39, a
 * least-squares fit over the 52k words in both lists (f ≥ 48; mean abs error
 * 15), then expressed as a pseudo-count on the SymSpell log scale so the
 * existing quantizer reproduces q exactly and every pre-existing word keeps
 * its byte. Words in both lists take the larger of the two (the keyboard
 * corpus ranks conversational words like "hi" far above the book corpus).
 */
function aospUnigramLines(baseCounts) {
  let min = Infinity;
  let max = 0;
  for (const c of baseCounts.values()) {
    if (c < min) min = c;
    if (c > max) max = c;
  }
  const lnMin = Math.log(min);
  const range = Math.log(max) - lnMin;
  const text = zlib
    .gunzipSync(
      fs.readFileSync(path.join(DATA_DIR, "en_US_wordlist.combined.gz")),
    )
    .toString("utf8");
  const lines = [];
  for (const line of text.split("\n")) {
    const m = /^ word=([a-z]+),f=(\d+)(.*)$/.exec(line);
    if (!m || m[3].includes("not_a_word=true")) continue;
    const q = Math.max(8, Math.min(255, Math.round(1.3 * Number(m[2]) - 39)));
    const count = Math.min(
      max,
      Math.round(Math.exp(lnMin + (q / 255) * range)),
    );
    lines.push(`${m[1]} ${count}`);
  }
  return lines.join("\n");
}

function readSources() {
  const symspellText =
    fs.readFileSync(
      path.join(DATA_DIR, "frequency_dictionary_en_82_765.txt"),
      "utf8",
    ) +
    "\n" +
    // Modern/informal vocabulary SCOWL lacks (ok, lol, wifi, bitcoin, ...);
    // without these autocorrect would mangle them.
    fs.readFileSync(path.join(DATA_DIR, "extra_words.txt"), "utf8");
  return {
    unigramText:
      symspellText + "\n" + aospUnigramLines(parseUnigrams(symspellText)),
    bigramText: fs.readFileSync(
      path.join(DATA_DIR, "frequency_bigramdictionary_en_243_342.txt"),
      "utf8",
    ),
    contractions: readForcedReplacements(),
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
