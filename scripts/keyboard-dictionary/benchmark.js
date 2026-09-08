"use strict";

/**
 * Accuracy benchmark for the reference correction engine against the shipped
 * dictionary. The golden vectors pin behavior; this measures it, so a tuning
 * change can be judged by numbers instead of by eye.
 *
 *   node scripts/keyboard-dictionary/benchmark.js [--sample N] [--seed N]
 *        [--tune freqWeight=1,wordSplit=0.75] [--dictionary path/to.echd]
 *
 * Sets:
 *  - wikipedia: Wikipedia's "Lists of common misspellings/For machines"
 *    (cognitive misspellings, CC BY-SA — fetched once into .build/, never
 *    vendored). Skipped when offline without a cached copy.
 *  - synthetic: seeded fat-finger typos over the 6k most frequent words
 *    (adjacent-key substitution 50%, transposition 12%, deletion 10%,
 *    adjacent insertion 10%, dropped double letter 9%, doubled letter 9%),
 *    scored with and without touch points.
 *  - oov: valid words the dictionary lacks (macOS /usr/share/dict/words),
 *    typed correctly — the share that would be autocorrected on Android,
 *    which has no system spell-checker veto. Skipped when the file is absent.
 *
 * Per set: top-1 / top-3 (correct word in the strip), autocorrect fire rate,
 * precision (fires that were right) and recall (right fires / all cases).
 */

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");

const {
  decode,
  evaluate,
  TUNING,
  KEY_ADJACENCY,
  KEY_CENTERS,
} = require("./decoder");

const WIKI_URL =
  "https://en.wikipedia.org/w/index.php?title=Wikipedia:Lists_of_common_misspellings/For_machines&action=raw";
const WIKI_CACHE = path.join(
  __dirname,
  "../../.build/keyboard-dictionary/wikipedia-misspellings.txt",
);
const WEB2 = "/usr/share/dict/words";

function parseArgs(argv) {
  const args = { sample: Infinity, seed: 12345, tune: {}, dictionary: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--sample") args.sample = Number(argv[++i]);
    else if (a === "--seed") args.seed = Number(argv[++i]);
    else if (a === "--dictionary") args.dictionary = argv[++i];
    else if (a === "--tune") {
      for (const kv of argv[++i].split(",")) {
        const [k, v] = kv.split("=");
        if (!(k in TUNING)) throw new Error(`Unknown TUNING key: ${k}`);
        args.tune[k] = Number(v);
      }
    }
  }
  return args;
}

function makeRng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        { headers: { "User-Agent": "echos-keyboard-benchmark" } },
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => resolve(body));
        },
      )
      .on("error", reject);
  });
}

async function wikipediaSet() {
  if (!fs.existsSync(WIKI_CACHE)) {
    try {
      const text = await fetchText(WIKI_URL);
      fs.mkdirSync(path.dirname(WIKI_CACHE), { recursive: true });
      fs.writeFileSync(WIKI_CACHE, text);
    } catch (err) {
      console.warn(`wikipedia set skipped (${err.message})`);
      return null;
    }
  }
  return fs
    .readFileSync(WIKI_CACHE, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("->"))
    .map((line) => {
      const [typed, expected] = line.split("->");
      return {
        typed: typed.trim(),
        expected: expected.split(",").map((w) => w.trim().toLowerCase()),
      };
    })
    .filter(
      (r) =>
        /^[a-z]+$/.test(r.typed) &&
        r.typed.length <= 32 &&
        r.expected.every((w) => /^[a-z']+$/.test(w)),
    );
}

/** One fat-finger error on `word`, with a simulated tap per typed char. */
function fatFinger(word, rnd) {
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const jitter = (c) => {
    const k = KEY_CENTERS[c];
    return k
      ? { x: k.x + (rnd() - 0.5) * 0.4, y: k.y + (rnd() - 0.5) * 0.4 }
      : null;
  };
  const chars = word.split("");
  const touches = chars.map(jitter);
  const kind = rnd();
  const i = Math.floor(rnd() * chars.length);
  if (kind < 0.5) {
    const adj = KEY_ADJACENCY[chars[i]];
    if (!adj) return null;
    const wrong = pick(adj.split(""));
    const a = KEY_CENTERS[chars[i]];
    const b = KEY_CENTERS[wrong];
    const f = 0.55 + rnd() * 0.25; // tap lands 55-80% of the way to the wrong key
    touches[i] = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    chars[i] = wrong;
  } else if (kind < 0.62) {
    if (chars.length < 4 || i >= chars.length - 1) return null;
    [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
    [touches[i], touches[i + 1]] = [touches[i + 1], touches[i]];
  } else if (kind < 0.72) {
    if (chars.length < 4) return null;
    chars.splice(i, 1);
    touches.splice(i, 1);
  } else if (kind < 0.81) {
    // helo for hello: drop one letter of a doubled pair
    const d = chars.findIndex((c, k) => k > 0 && chars[k - 1] === c);
    if (d < 0) return null;
    chars.splice(d, 1);
    touches.splice(d, 1);
  } else if (kind < 0.9) {
    // helllo, comming: double a letter
    chars.splice(i, 0, chars[i]);
    touches.splice(i, 0, jitter(chars[i]));
  } else {
    const adj = KEY_ADJACENCY[chars[i]];
    if (!adj) return null;
    const extra = pick(adj.split(""));
    chars.splice(i + 1, 0, extra);
    touches.splice(i + 1, 0, jitter(extra));
  }
  const typed = chars.join("");
  return typed === word ? null : { typed, expected: [word], touches };
}

function syntheticSet(model, rnd) {
  const rows = [];
  for (let i = 0; i < 6000; i++) {
    const word = model.topString(i);
    if (!word || !/^[a-z]{3,}$/.test(word)) continue;
    const row = fatFinger(word, rnd);
    if (row) rows.push(row);
  }
  return rows;
}

function oovSet(model) {
  if (!fs.existsSync(WEB2)) return null;
  return fs
    .readFileSync(WEB2, "utf8")
    .split("\n")
    .filter((w) => /^[a-z]{4,12}$/.test(w) && model.find(w) === null)
    .map((w) => ({ typed: w, expected: [w] }));
}

function sample(rows, n, rnd) {
  if (!rows || rows.length <= n) return rows;
  return rows.filter(() => rnd() < n / rows.length);
}

function pct(a, b) {
  return b ? `${((100 * a) / b).toFixed(1)}%` : "n/a";
}

function score(model, rows, useTouch) {
  let top1 = 0;
  let top3 = 0;
  let fired = 0;
  let right = 0;
  const wrongFires = [];
  for (const r of rows) {
    const res = evaluate(model, r.typed, null, {
      touchPoints: useTouch ? r.touches : null,
    });
    const cands = res.candidates.map((c) => c.toLowerCase());
    const ok = (w) => r.expected.includes(w);
    if (cands[0] && ok(cands[0])) top1++;
    if (cands.some(ok)) top3++;
    if (res.topIsCorrection) {
      fired++;
      if (ok(res.replacement.toLowerCase())) right++;
      else if (wrongFires.length < 8) {
        wrongFires.push(`${r.typed}->${res.replacement}`);
      }
    }
  }
  const n = rows.length;
  return {
    n,
    top1: pct(top1, n),
    top3: pct(top3, n),
    fired: pct(fired, n),
    precision: pct(right, fired),
    recall: pct(right, n),
    wrongFires,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  Object.assign(TUNING, args.tune);
  const dictionary =
    args.dictionary ??
    path.join(
      __dirname,
      "../../data/keyboard-dictionary/keyboard_dictionary.echd",
    );
  const model = decode(fs.readFileSync(dictionary));
  const rnd = makeRng(args.seed);

  const wiki = sample(await wikipediaSet(), args.sample, rnd);
  const synthetic = sample(syntheticSet(model, rnd), args.sample, rnd);
  const oov = sample(oovSet(model), Math.min(args.sample, 3000), rnd);

  const rows = [];
  if (wiki) rows.push(["wikipedia misspellings", score(model, wiki, false)]);
  rows.push(["fat-finger, static adjacency", score(model, synthetic, false)]);
  rows.push(["fat-finger, touch points", score(model, synthetic, true)]);
  if (oov)
    rows.push([
      "valid OOV words (false-positive proxy)",
      score(model, oov, false),
    ]);

  console.log(
    `dictionary: ${path.relative(process.cwd(), dictionary)} (${model.header.wordCount} words)` +
      (Object.keys(args.tune).length
        ? `  tune: ${JSON.stringify(args.tune)}`
        : ""),
  );
  console.table(
    Object.fromEntries(
      rows.map(([name, s]) => [
        name,
        {
          n: s.n,
          top1: s.top1,
          top3: s.top3,
          fired: s.fired,
          precision: s.precision,
          recall: s.recall,
        },
      ]),
    ),
  );
  for (const [name, s] of rows) {
    if (s.wrongFires.length)
      console.log(`${name} — wrong fires: ${s.wrongFires.join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
