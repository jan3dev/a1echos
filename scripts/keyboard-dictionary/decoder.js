"use strict";

/**
 * Decoder + reference correction engine for the "ECHD" v1 binary.
 *
 * The fuzzy search / scoring here is the canonical specification that
 * CorrectionEngine.swift and CorrectionEngine.kt mirror 1:1. Golden vectors in
 * the jest suite are generated from this implementation.
 */

const {
  MAGIC,
  VERSION,
  HEADER_SIZE,
  NODE_SIZE,
  LEAF,
  NON_TERMINAL_WORD_ID,
  FLAG_NEVER_CORRECT_TO,
  FLAG_PROPER_NOUN,
  crc32,
} = require("./encoder");

/**
 * Contractions whose typed form is ALSO a valid word (its, ill, id, lets).
 * Auto-applied only when sentence-initial AND typed with a leading capital
 * ("Its way" -> "It's way") — the capitalization comes from auto-cap, so this
 * naturally limits to sentence starts, where the contraction reading
 * dominates. Mid-sentence lowercase "its"/"ill" stay untouched.
 */
const AMBIGUOUS_SENTENCE_INITIAL = {
  its: "It's",
  ill: "I'll",
  id: "I'd",
  lets: "Let's",
};

const TUNING = {
  subAdjacent: 0.6,
  subOther: 1.0,
  // Touch-model substitution cost: a tap within `subTouchDeadZone` key-widths
  // of the candidate key's center costs `subTouchMin`; beyond that the cost
  // grows by `subTouchPerUnit` per key-width, capped at `subOther`. A tap
  // dead-center on an adjacent key (d = 1.0) prices close to `subAdjacent`.
  subTouchMin: 0.35,
  subTouchBase: 0.25,
  subTouchPerUnit: 0.55,
  subTouchDeadZone: 0.4,
  insertDuplicate: 0.5,
  insertOther: 1.0,
  deletionDuplicate: 0.5,
  deletion: 0.9,
  transposition: 0.5,
  // First-letter typos are rarer than mid-word ones, so they carry a surcharge
  // — but not so steep that a clear touch signal near the intended first key
  // (spatial model) can't overcome it ("yhe" with the first tap by 't' -> the).
  firstLetterSurcharge: 0.5,
  apostropheRestore: 0.15,
  wordSplit: 0.45,
  completionPerChar: 0.2,
  completionCap: 0.9,
  // Completions may drive autocorrect-on-space only when the typed prefix is
  // long, the tail short, and the word common; everything else stays a
  // tap-only suggestion (sata must not become satan).
  autocorrectMaxCompletionExtra: 2,
  autocorrectCompletionMinTyped: 5,
  autocorrectMaxScoreGap: 0.25,
  shortTypedMaxEditCost: 0.9,
  freqWeight: 0.35,
  bigramWeight: 0.4,
  maxCandidates: 3,
  maxCompletions: 8,
  confidenceCommon: 0.6,
  confidenceRare: 0.72,
  confidenceBigramBonus: 0.08,
  commonFreqFloor: 64,
  // Next-word prediction: how far down the frequency-ranked word list to scan
  // when filling prediction slots the bigram table left empty.
  predictionFallbackScan: 16,
  // Neural reranker (optional): the top `lmTopCandidates` scored candidates
  // get their word-level logprobs (length-normalized, given the left
  // context) softmaxed into probabilities, each worth up to `lmStrength`
  // score points — enough to reorder near-ties but not to resurrect a
  // distant edit. For the sentence-initial confusables (ill/its/id/lets)
  // the contraction must beat the literal reading's logprob by
  // `lmConfusableMargin` or the word is left alone.
  lmTopCandidates: 5,
  lmStrength: 1.0,
  lmConfusableMargin: 0,
};

/**
 * Curated sentence-openers shown when there is no previous word (empty field
 * or just after sentence-terminal punctuation), where the bigram table has no
 * context to work from. Lowercase; the caller applies sentence casing.
 * Mirrored verbatim in the native engines.
 */
const SENTENCE_STARTERS = ["i", "the", "you", "it", "we", "thanks", "hey"];

const KEY_ADJACENCY = {
  q: "wa",
  w: "qeas",
  e: "wrsd",
  r: "etdf",
  t: "ryfg",
  y: "tugh",
  u: "yihj",
  i: "uojk",
  o: "ipkl",
  p: "ol",
  a: "qwsz",
  s: "weadzx",
  d: "ersfxc",
  f: "rtdgcv",
  g: "tyfhvb",
  h: "yugjbn",
  j: "uihknm",
  k: "iojlm",
  l: "opk",
  z: "asx",
  x: "sdzc",
  c: "dfxv",
  v: "fgcb",
  b: "ghvn",
  n: "hjbm",
  m: "jkn",
};

function isAdjacent(a, b) {
  const neighbors = KEY_ADJACENCY[a];
  return neighbors !== undefined && neighbors.includes(b);
}

/**
 * Letter-key centers in key-grid units (key width = 1.0) on the standard
 * QWERTY 10/9/7 layout: row y at 0.5/1.5/2.5, with the home and bottom rows
 * indented by half and one-and-a-half key widths. Native key views normalize
 * their tap coordinates into this same space.
 */
const KEY_CENTERS = (() => {
  const rows = [
    ["qwertyuiop", 0.5, 0.5],
    ["asdfghjkl", 1.0, 1.5],
    ["zxcvbnm", 2.0, 2.5],
  ];
  const centers = {};
  for (const [letters, x0, y] of rows) {
    for (let i = 0; i < letters.length; i++) {
      centers[letters[i]] = { x: x0 + i, y };
    }
  }
  return centers;
})();

/**
 * Substitution cost for consuming candidate char `c` where the user typed
 * `t`. With a touch point, cost scales with the tap's distance from `c`'s key
 * center — a borderline tap is cheap to reinterpret, a distant one is not.
 * Without touch data, falls back to the static adjacency graph. `center` is
 * `c`'s key center; the DP caller resolves it once per candidate char so the
 * inner loop over typed positions doesn't repeat the lookup.
 */
function substitutionCost(t, c, touchPoint, center = KEY_CENTERS[c]) {
  if (t === c) return 0;
  if (touchPoint) {
    if (center) {
      const dx = touchPoint.x - center.x;
      const dy = touchPoint.y - center.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const cost =
        TUNING.subTouchBase +
        TUNING.subTouchPerUnit * Math.max(0, d - TUNING.subTouchDeadZone);
      return Math.min(TUNING.subOther, Math.max(TUNING.subTouchMin, cost));
    }
  }
  return isAdjacent(t, c) ? TUNING.subAdjacent : TUNING.subOther;
}

function editBudget(typedLength) {
  if (typedLength <= 4) return 1.0;
  if (typedLength <= 8) return 2.0;
  return 2.5;
}

function decode(buffer) {
  if (buffer.length < HEADER_SIZE) throw new Error("Buffer too small");
  if (buffer.toString("ascii", 0, 4) !== MAGIC) throw new Error("Bad magic");
  const version = buffer.readUInt16LE(4);
  if (version !== VERSION) throw new Error(`Unsupported version ${version}`);
  const header = {
    version,
    flags: buffer.readUInt16LE(6),
    nodeCount: buffer.readUInt32LE(8),
    wordCount: buffer.readUInt32LE(12),
    nodesOffset: buffer.readUInt32LE(16),
    labelsOffset: buffer.readUInt32LE(20),
    labelsLength: buffer.readUInt32LE(24),
    topStringsOffset: buffer.readUInt32LE(28),
    topStringsCount: buffer.readUInt32LE(32),
    bigramsOffset: buffer.readUInt32LE(36),
    bigramCount: buffer.readUInt32LE(40),
    contractionsOffset: buffer.readUInt32LE(44),
    contractionCount: buffer.readUInt32LE(48),
    crc32: buffer.readUInt32LE(52),
  };
  if (crc32(buffer.subarray(HEADER_SIZE)) !== header.crc32) {
    throw new Error("CRC mismatch");
  }

  const node = (index) => {
    const off = header.nodesOffset + index * NODE_SIZE;
    const packed = buffer.readUInt32LE(off + 8);
    const labelOffset = buffer.readUInt32LE(off + 4);
    const labelLen = buffer.readUInt8(off + 12);
    return {
      index,
      firstChildIndex: buffer.readUInt32LE(off),
      label: buffer.toString(
        "utf8",
        header.labelsOffset + labelOffset,
        header.labelsOffset + labelOffset + labelLen,
      ),
      wordId: packed & 0xffffff,
      flags: (packed >>> 24) & 0xff,
      terminal: ((packed >>> 24) & 0x01) !== 0,
      childCount: buffer.readUInt8(off + 13),
      freq: buffer.readUInt8(off + 14),
      maxSubtreeFreq: buffer.readUInt8(off + 15),
    };
  };

  const topString = (id) => {
    if (id >= header.topStringsCount) return null;
    const base = header.topStringsOffset;
    const poolStart = base + 4 * (header.topStringsCount + 1);
    const start = buffer.readUInt32LE(base + 4 * id);
    const end = buffer.readUInt32LE(base + 4 * (id + 1));
    return buffer.toString("utf8", poolStart + start, poolStart + end);
  };

  const contractions = new Map();
  {
    const base = header.contractionsOffset;
    const poolStart = base + 6 * header.contractionCount;
    for (let i = 0; i < header.contractionCount; i++) {
      const off = base + i * 6;
      const typedOffset = buffer.readUInt16LE(off);
      const typedLen = buffer.readUInt8(off + 2);
      const replOffset = buffer.readUInt16LE(off + 3);
      const replLen = buffer.readUInt8(off + 5);
      contractions.set(
        buffer.toString(
          "utf8",
          poolStart + typedOffset,
          poolStart + typedOffset + typedLen,
        ),
        buffer.toString(
          "utf8",
          poolStart + replOffset,
          poolStart + replOffset + replLen,
        ),
      );
    }
  }

  /**
   * Walks `word` through the trie. Returns:
   *  - { node, remainder: "" } when the walk consumed the whole word
   *    (remainder of the final label in `labelRest`), or null when the word
   *    diverges from every path.
   */
  const walk = (word) => {
    let current = node(0);
    let pos = 0;
    for (;;) {
      if (pos === word.length) return { node: current, labelRest: "" };
      if (current.firstChildIndex === LEAF) return null;
      let child = null;
      for (let c = 0; c < current.childCount; c++) {
        const candidate = node(current.firstChildIndex + c);
        if (candidate.label[0] === word[pos]) {
          child = candidate;
          break;
        }
      }
      if (!child) return null;
      const label = child.label;
      let k = 0;
      while (
        k < label.length &&
        pos + k < word.length &&
        label[k] === word[pos + k]
      ) {
        k++;
      }
      if (pos + k === word.length) {
        return { node: child, labelRest: label.slice(k) };
      }
      if (k < label.length) return null;
      current = child;
      pos += k;
    }
  };

  /** Exact lookup; returns the terminal node record or null. */
  const find = (word) => {
    const hit = walk(word);
    return hit && hit.labelRest === "" && hit.node.terminal ? hit.node : null;
  };

  const bigramsFor = (prevWord) => {
    const prev = find(prevWord.toLowerCase());
    if (!prev || prev.wordId === NON_TERMINAL_WORD_ID) return [];
    const prevId = prev.wordId;
    let lo = 0;
    let hi = header.bigramCount;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (buffer.readUIntLE(header.bigramsOffset + mid * 8, 3) < prevId) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    const results = [];
    for (let i = lo; i < header.bigramCount; i++) {
      const off = header.bigramsOffset + i * 8;
      if (buffer.readUIntLE(off, 3) !== prevId) break;
      const nextId = buffer.readUIntLE(off + 3, 3);
      results.push({
        nextId,
        word: topString(nextId),
        freq: buffer.readUInt8(off + 6),
      });
    }
    return results;
  };

  const words = function* () {
    const stack = [{ index: 0, prefix: "" }];
    while (stack.length) {
      const { index, prefix } = stack.pop();
      const current = node(index);
      const path = prefix + current.label;
      if (current.terminal) {
        yield {
          word: path,
          wordId: current.wordId,
          freq: current.freq,
          flags: current.flags,
        };
      }
      if (current.firstChildIndex !== LEAF) {
        for (let c = current.childCount - 1; c >= 0; c--) {
          stack.push({ index: current.firstChildIndex + c, prefix: path });
        }
      }
    }
  };

  return {
    buffer,
    header,
    node,
    topString,
    contractions,
    walk,
    find,
    bigramsFor,
    words,
  };
}

function applyFirstLetterSurcharge(typed, word, editCost) {
  if (editCost === 0 || typed[0] === word[0]) return editCost;
  const transposedFirstPair =
    typed.length >= 2 &&
    word.length >= 2 &&
    typed[0] === word[1] &&
    typed[1] === word[0];
  return transposedFirstPair
    ? editCost
    : editCost + TUNING.firstLetterSurcharge;
}

/**
 * Weighted Damerau-Levenshtein DP over trie descent. Returns fuzzy full-word
 * candidates as { word, editCost, freq, flags }. `touchPoints`, when given,
 * holds one normalized tap per typed char (null per char without data) and
 * refines substitution costs via the spatial model.
 */
function fuzzyMatches(model, typed, touchPoints = null) {
  const n = typed.length;
  // A stale buffer must degrade to the static adjacency model, never skew
  // costs against the wrong characters.
  const touches = touchPoints && touchPoints.length === n ? touchPoints : null;
  const budget = editBudget(n);
  const insertCost = (i) =>
    i >= 2 && typed[i - 1] === typed[i - 2]
      ? TUNING.insertDuplicate
      : TUNING.insertOther;

  const row0 = new Array(n + 1);
  row0[0] = 0;
  for (let i = 1; i <= n; i++) row0[i] = row0[i - 1] + insertCost(i);

  const results = [];
  // rows[j] = DP row after j path characters; the stack shape lets the
  // Damerau transposition reach rows[j-2].
  const rows = [row0];
  const pathChars = [];

  const dfs = (index) => {
    const depthBefore = pathChars.length;
    const current = model.node(index);
    const label = index === 0 ? "" : current.label;
    let pruned = false;
    for (const c of label) {
      const j = pathChars.length + 1;
      const prevRow = rows[j - 1];
      // Omitting a doubled letter (helo -> hello) is as common a typo as
      // inserting one, so consuming a candidate char that repeats the
      // previous path char is cheap.
      const deleteCost =
        j >= 2 && c === pathChars[j - 2]
          ? TUNING.deletionDuplicate
          : TUNING.deletion;
      const newRow = new Array(n + 1);
      newRow[0] = prevRow[0] + deleteCost;
      let rowMin = newRow[0];
      const center = KEY_CENTERS[c];
      for (let i = 1; i <= n; i++) {
        const t = typed[i - 1];
        const subCost = substitutionCost(
          t,
          c,
          touches && touches[i - 1],
          center,
        );
        let best = Math.min(
          prevRow[i - 1] + subCost,
          newRow[i - 1] + insertCost(i),
          prevRow[i] + deleteCost,
        );
        if (j >= 2 && i >= 2 && t === pathChars[j - 2] && typed[i - 2] === c) {
          best = Math.min(best, rows[j - 2][i - 2] + TUNING.transposition);
        }
        newRow[i] = best;
        if (best < rowMin) rowMin = best;
      }
      rows.push(newRow);
      pathChars.push(c);
      if (rowMin > budget + 1e-6) {
        pruned = true;
        break;
      }
    }
    if (!pruned) {
      if (current.terminal && pathChars.length > 0) {
        const word = pathChars.join("");
        const editCost = applyFirstLetterSurcharge(
          typed,
          word,
          rows[rows.length - 1][n],
        );
        if (editCost <= budget + 1e-6) {
          results.push({
            word,
            editCost,
            freq: current.freq,
            flags: current.flags,
          });
        }
      }
      if (current.firstChildIndex !== LEAF) {
        for (let c = 0; c < current.childCount; c++) {
          dfs(current.firstChildIndex + c);
        }
      }
    }
    rows.length = depthBefore + 1;
    pathChars.length = depthBefore;
  };
  dfs(0);
  return results;
}

/**
 * Exact-prefix completions: walk `typed` through the trie, then best-first
 * over maxSubtreeFreq collect the most frequent terminals below, with a
 * per-extra-character penalty.
 */
function completions(model, typed) {
  const hit = model.walk(typed);
  if (!hit) return [];
  const results = [];
  const queue = [];
  if (hit.labelRest.length > 0) {
    // Prefix ends mid-label: the entry node itself completes the word.
    queue.push({ index: hit.node.index, suffix: hit.labelRest });
  } else if (hit.node.firstChildIndex !== LEAF) {
    for (let c = 0; c < hit.node.childCount; c++) {
      const child = model.node(hit.node.firstChildIndex + c);
      queue.push({ index: child.index, suffix: child.label });
    }
  }
  while (queue.length && results.length < TUNING.maxCompletions) {
    queue.sort(
      (a, b) =>
        model.node(b.index).maxSubtreeFreq -
          model.node(a.index).maxSubtreeFreq || a.index - b.index,
    );
    const { index, suffix } = queue.shift();
    const current = model.node(index);
    if (current.terminal && suffix.length > 0) {
      const penalty = Math.min(
        TUNING.completionCap,
        TUNING.completionPerChar * suffix.length,
      );
      results.push({
        word: typed + suffix,
        editCost: penalty,
        freq: current.freq,
        flags: current.flags,
        completionExtra: suffix.length,
      });
    }
    if (current.firstChildIndex !== LEAF) {
      for (let c = 0; c < current.childCount; c++) {
        const child = model.node(current.firstChildIndex + c);
        queue.push({ index: child.index, suffix: suffix + child.label });
      }
    }
  }
  return results;
}

/**
 * Apostrophe restoration (cant -> can't, wont -> won't): probe the exact
 * dictionary for the typed word with an apostrophe inserted at each interior
 * position. Cheap (len-1 exact lookups) and mirrors native iOS behavior.
 */
function apostropheVariants(model, typed) {
  if (typed.includes("'")) return [];
  const results = [];
  for (let i = 1; i < typed.length; i++) {
    const variant = typed.slice(0, i) + "'" + typed.slice(i);
    const hit = model.find(variant);
    if (hit) {
      results.push({
        word: variant,
        editCost: TUNING.apostropheRestore,
        freq: hit.freq,
        flags: hit.flags,
      });
    }
  }
  return results;
}

/**
 * Proper-noun possessive restoration (johns -> "John's"): when the typed word
 * ends in `s`, is not itself a dictionary word, and dropping the `s` yields a
 * known proper noun, offer the possessive. The not-in-dictionary + proper-noun
 * gate keeps ordinary plurals (dogs) untouched.
 */
function properNounPossessives(model, typed) {
  if (typed.length < 3 || !typed.endsWith("s") || typed.includes("'"))
    return [];
  if (model.find(typed)) return [];
  const base = typed.slice(0, -1);
  const node = model.find(base);
  if (!node || (node.flags & FLAG_PROPER_NOUN) === 0) return [];
  return [
    {
      word: base + "'s",
      editCost: TUNING.apostropheRestore,
      freq: node.freq,
      flags: node.flags,
    },
  ];
}

/**
 * The expansion to use when a split half is itself a forced-replacement entry,
 * or undefined when it is not eligible. Real contractions always expand to an
 * apostrophe form (build.js asserts this); forced corrections never do.
 */
function splitContraction(model, half) {
  const expansion = model.contractions.get(half);
  return expansion !== undefined && expansion.includes("'")
    ? expansion
    : undefined;
}

/**
 * Missing-space restoration (alot -> "a lot"): split the typed run at each
 * interior position and offer the pair when both halves are common words.
 */
function wordSplits(model, typed) {
  if (typed.length < 3 || typed.includes("'") || typed.includes("-")) return [];
  // For a valid typed word ("maybe", "forgot") a split is only plausible when
  // the corpus has seen the pair ("may be" yes, "for got" no).
  const typedIsValid = model.find(typed) !== null;
  const results = [];
  for (let i = 1; i < typed.length; i++) {
    const leftWord = typed.slice(0, i);
    const rightWord = typed.slice(i);
    // A half may be a contraction typed-form: imnot -> "I'm not". Only real
    // apostrophe forms count: the same table also carries forced corrections
    // (calender -> calendar), whose typed form is an ordinary misspelling, so
    // a split around it is not self-evident and must earn bigram evidence
    // below like any other split. Without this, wetherman would autocorrect
    // to "whether man" ahead of weatherman.
    const leftContraction = splitContraction(model, leftWord);
    const rightContraction = splitContraction(model, rightWord);
    const left = model.find(leftWord);
    const right = model.find(rightWord);
    if (!leftContraction && (!left || left.freq < TUNING.commonFreqFloor)) {
      continue;
    }
    if (!rightContraction && (!right || right.freq < TUNING.commonFreqFloor)) {
      continue;
    }
    const contractionHalf = Boolean(leftContraction || rightContraction);
    const hasBigram =
      !contractionHalf &&
      right !== null &&
      model.bigramsFor(leftWord).some((bg) => bg.nextId === right.wordId);
    if (typedIsValid && !hasBigram) continue;
    const renderHalf = (w, contraction) => contraction ?? (w === "i" ? "I" : w);
    results.push({
      word:
        renderHalf(leftWord, leftContraction) +
        " " +
        renderHalf(rightWord, rightContraction),
      editCost: TUNING.wordSplit,
      freq: Math.min(left?.freq ?? 255, right?.freq ?? 255),
      flags: (left?.flags ?? 0) | (right?.flags ?? 0),
      // Contraction splits are self-evident; plain splits need corpus
      // evidence before autocorrect may apply them.
      splitHasBigram: contractionHalf || hasBigram,
    });
  }
  return results;
}

/**
 * Canonical form of a user-typed token: lowercased, with the typographic
 * apostrophe folded to ASCII so `dont`/`don’t` reach the same trie path. Keep
 * in sync with `CorrectionEngine.normalize` on both platforms — every entry
 * point that receives raw user text must go through this.
 */
function normalizeToken(word) {
  return word.toLowerCase().replace(/’/g, "'");
}

/** Merged fuzzy + completion candidates, deduped keeping the lowest cost. */
function search(model, typedRaw, touchPoints = null) {
  const typed = normalizeToken(typedRaw);
  if (!typed || typed.length > 32) return [];
  const merged = new Map();
  const addAll = (list) => {
    for (const c of list) {
      const existing = merged.get(c.word);
      if (!existing || c.editCost < existing.editCost) merged.set(c.word, c);
    }
  };
  addAll(fuzzyMatches(model, typed, touchPoints));
  addAll(apostropheVariants(model, typed));
  addAll(properNounPossessives(model, typed));
  addAll(wordSplits(model, typed));
  if (typed.length >= 2) addAll(completions(model, typed));
  return [...merged.values()];
}

function scoreCandidates(model, rawCandidates, prevWord) {
  const bigramFreqs = new Map();
  if (prevWord) {
    for (const bg of model.bigramsFor(prevWord)) {
      if (bg.word) bigramFreqs.set(bg.word, bg.freq);
    }
  }
  return rawCandidates
    .map((c) => {
      const bigramFreq = bigramFreqs.get(c.word) ?? 0;
      return {
        ...c,
        bigramFreq,
        score:
          -c.editCost +
          (TUNING.freqWeight * c.freq) / 255 +
          (TUNING.bigramWeight * bigramFreq) / 255,
      };
    })
    .sort(byScoreThenWord);
}

/**
 * Canonical candidate ordering: score descending, ties broken by word
 * ascending. The tie-break is pinned by the parity fixtures, so the Swift
 * (`CorrectionEngine.candidateOrder`) and Kotlin (`candidateOrder`) mirrors
 * must match it exactly.
 */
function byScoreThenWord(a, b) {
  return b.score - a.score || (a.word < b.word ? -1 : 1);
}

/**
 * Blends neural language-model evidence into the classical ranking. The
 * reranker scores each candidate word as a continuation of `leftContext`
 * (length-normalized logprob); those become a softmax distribution over the
 * top candidates, worth up to `lmStrength` score points each. Candidates
 * outside the top-N keep their scores and re-sort alongside. A reranker
 * returning null (model not loaded, over budget) leaves the ranking
 * untouched — with `reranker` absent this function is the identity, which
 * the parity fixtures pin.
 */
function applyLmRerank(scored, leftContext, reranker, lmStrength) {
  if (!reranker || scored.length < 2) return scored;
  const n = Math.min(TUNING.lmTopCandidates, scored.length);
  const words = scored.slice(0, n).map((c) => renderCandidate(c.word, c.flags));
  const logProbs = reranker.scores(leftContext ?? "", words);
  if (!logProbs || logProbs.length !== n) return scored;
  const maxLp = Math.max(...logProbs);
  const exps = logProbs.map((lp) => Math.exp(lp - maxLp));
  const sum = exps.reduce((a, b) => a + b, 0);
  const out = scored.slice();
  for (let i = 0; i < n; i++) {
    out[i] = { ...out[i], score: out[i].score + (lmStrength * exps[i]) / sum };
  }
  return out.sort(byScoreThenWord);
}

/**
 * Full reference evaluation mirroring the native engines' public behavior.
 * `typedRaw` keeps original casing (for the ALL-CAPS gate). `knownValid`
 * models the platform vetoes (user lexicon / UITextChecker); `blacklisted`
 * models the learned "don't correct X to Y" pairs. `leftContext` is the
 * text before the typed word (may span sentence boundaries); `reranker`
 * exposes `scores(leftContext, words) -> logProbs|null` backed by the
 * on-device LM.
 */
function evaluate(model, typedRaw, prevWord = null, options = {}) {
  const {
    knownValid = false,
    blacklisted = () => false,
    touchPoints = null,
    leftContext = null,
    reranker = null,
    lmStrength = TUNING.lmStrength,
  } = options;
  const typed = normalizeToken(typedRaw);
  const empty = {
    candidates: [],
    topIsCorrection: false,
    verbatim: null,
    replacement: null,
  };
  if (!typed || typed.length > 32) return empty;
  if (/\d/.test(typed)) return empty;

  // The sole one-character correction: standalone lowercase "i" becomes "I"
  // (mid-sentence, where auto-cap can't help).
  if (typedRaw === "i" && !blacklisted("i", "i")) {
    return {
      candidates: ["I"],
      topIsCorrection: true,
      verbatim: typedRaw,
      replacement: "I",
    };
  }

  const ambiguous = AMBIGUOUS_SENTENCE_INITIAL[typed];
  if (
    ambiguous &&
    !prevWord &&
    typedRaw === typed[0].toUpperCase() + typed.slice(1) &&
    !blacklisted(typed, ambiguous.toLowerCase())
  ) {
    // With an LM available this stops being a blind rule: the contraction
    // must actually read better than the literal word in context ("Ill be
    // there" contracts, "Ill patients need rest" stays).
    if (reranker) {
      const lps = reranker.scores(leftContext ?? "", [typedRaw, ambiguous]);
      if (
        lps &&
        lps.length === 2 &&
        lps[1] - lps[0] <= TUNING.lmConfusableMargin
      ) {
        return {
          candidates: [ambiguous],
          topIsCorrection: false,
          verbatim: null,
          replacement: null,
        };
      }
    }
    return {
      candidates: [ambiguous],
      topIsCorrection: true,
      verbatim: typedRaw,
      replacement: ambiguous,
    };
  }

  const contraction = model.contractions.get(typed);
  if (contraction && !blacklisted(typed, contraction.toLowerCase())) {
    return {
      candidates: [contraction],
      topIsCorrection: true,
      verbatim: typedRaw,
      replacement: contraction,
    };
  }

  // Proper nouns typed all-lowercase self-correct to title case
  // (france -> France), like native iOS.
  if (typedRaw === typed) {
    const typedNode = model.find(typed);
    if (
      typedNode &&
      (typedNode.flags & FLAG_PROPER_NOUN) !== 0 &&
      !blacklisted(typed, typed)
    ) {
      const properForm = typed[0].toUpperCase() + typed.slice(1);
      return {
        candidates: [properForm],
        topIsCorrection: true,
        verbatim: typedRaw,
        replacement: properForm,
      };
    }
  }

  const raw = search(model, typed, touchPoints).filter(
    (c) => c.editCost === 0 || (c.flags & FLAG_NEVER_CORRECT_TO) === 0,
  );
  const scored = applyLmRerank(
    scoreCandidates(model, raw, prevWord).filter((c) => c.word !== typed),
    leftContext,
    reranker,
    lmStrength,
  );
  const top3 = scored
    .slice(0, TUNING.maxCandidates)
    .map((c) => renderCandidate(c.word, c.flags));

  // Autocorrect considers the best candidate that is safe to apply blindly:
  // speculative completions (long tail / rare / short prefix) and splits the
  // corpus has never seen stay tap-only, so the strip may lead with
  // "wichita" while space still commits "which". The fallback may not walk
  // far down the ranking (sata must not fall through satan to sara), and
  // short typed words demand tight edits (keyb must not become key).
  const acTop = scored.find((c) => {
    if (scored[0].score - c.score > TUNING.autocorrectMaxScoreGap) return false;
    const extra = c.completionExtra ?? 0;
    if (extra > TUNING.autocorrectMaxCompletionExtra) return false;
    if (
      extra > 0 &&
      (c.freq < TUNING.commonFreqFloor ||
        typed.length < TUNING.autocorrectCompletionMinTyped)
    ) {
      return false;
    }
    if (c.splitHasBigram === false) return false;
    if (typed.length <= 4 && c.editCost > TUNING.shortTypedMaxEditCost) {
      return false;
    }
    return true;
  });

  const isAllCapsAcronym =
    typedRaw.length <= 5 &&
    typedRaw === typedRaw.toUpperCase() &&
    /[A-Z]/.test(typedRaw);
  // Very short typed words have too many plausible neighbors; only replace
  // them with common words (fuk must not become fum).
  const shortTypedRareTop =
    acTop !== undefined &&
    typed.length <= 3 &&
    acTop.freq < TUNING.commonFreqFloor;
  let topIsCorrection = false;
  if (
    acTop &&
    model.find(typed) === null &&
    !knownValid &&
    typed.length > 1 &&
    !isAllCapsAcronym &&
    !typed.includes("-") &&
    !shortTypedRareTop &&
    !blacklisted(typed, acTop.word)
  ) {
    const conf = 1 - acTop.editCost / Math.max(typed.length, acTop.word.length);
    let threshold =
      acTop.freq >= TUNING.commonFreqFloor
        ? TUNING.confidenceCommon
        : TUNING.confidenceRare;
    if (acTop.bigramFreq > 0) threshold -= TUNING.confidenceBigramBonus;
    topIsCorrection = conf >= threshold;
  }

  return {
    candidates: top3,
    topIsCorrection,
    verbatim: topIsCorrection ? typedRaw : null,
    replacement: topIsCorrection
      ? renderCandidate(acTop.word, acTop.flags)
      : null,
  };
}

/** Proper nouns (France, Monday, Google) render title-case; split candidates
 *  (contain a space) keep their per-half casing. */
function renderCandidate(word, flags) {
  if ((flags & FLAG_PROPER_NOUN) === 0 || word.includes(" ")) return word;
  return word[0].toUpperCase() + word.slice(1);
}

/**
 * Parses the bundled `confusables.json` into a lookup map. Each entry keys a
 * valid plain word (which the engine would otherwise never correct) to its
 * contraction and the set of following words that imply the contraction
 * reading. Keys/triggers are lowercased.
 */
function parseConfusables(json) {
  const map = new Map();
  for (const [plain, entry] of Object.entries(json)) {
    if (plain.startsWith("_") || !entry || typeof entry !== "object") continue;
    if (!entry.contraction || !Array.isArray(entry.next)) continue;
    map.set(plain.toLowerCase(), {
      contraction: entry.contraction,
      next: new Set(entry.next.map((w) => w.toLowerCase())),
    });
  }
  return map;
}

/**
 * Context-aware confusable correction (retroactive). Given the previous
 * committed word (as typed) and the word that just followed it, returns the
 * contraction the previous word should become — or null to leave it. Fires
 * only for a lowercase plain word whose follower is in its trigger set, and
 * never for a blacklisted pair. The caller applies the rewrite and is
 * responsible for confirming the two words were separated by a single space.
 */
function contextualContraction(
  confusables,
  prevWordRaw,
  nextWord,
  blacklisted = () => false,
) {
  if (!prevWordRaw || !nextWord) return null;
  const plain = prevWordRaw.toLowerCase();
  // Only touch a word the user typed all-lowercase; a leading capital is the
  // sentence-initial rule's job (or a deliberate proper noun).
  if (prevWordRaw !== plain) return null;
  const entry = confusables.get(plain);
  if (!entry) return null;
  if (!entry.next.has(nextWord.toLowerCase())) return null;
  if (blacklisted(plain, entry.contraction.toLowerCase())) return null;
  return entry.contraction;
}

/**
 * Next-character weights for the in-progress prefix, from the trie's
 * maxSubtreeFreq — the signal behind invisible key-target resizing (the
 * pre-iOS-17 Apple keyboard's biggest error-prevention lever, US8232973).
 * Returns a Map of lowercase letter -> weight in (0, 1], normalized to the
 * strongest continuation, rounded to 4 decimals so the Float32 native
 * engines can pin identical fixtures. Empty when the prefix has left the
 * trie (a typo in progress) — hit targets then stay at visible geometry.
 */
function nextCharWeights(model, prefixRaw) {
  const prefix = normalizeToken(prefixRaw);
  const weights = new Map();
  if (!prefix || prefix.length > 24) return weights;
  const hit = model.walk(prefix);
  if (!hit) return weights;
  const add = (ch, freq) => {
    if (ch < "a" || ch > "z") return; // only letter keys resize
    const existing = weights.get(ch);
    if (existing === undefined || freq > existing) weights.set(ch, freq);
  };
  if (hit.labelRest.length > 0) {
    add(hit.labelRest[0], hit.node.maxSubtreeFreq);
  } else if (hit.node.firstChildIndex !== LEAF) {
    for (let c = 0; c < hit.node.childCount; c++) {
      const child = model.node(hit.node.firstChildIndex + c);
      add(child.label[0], child.maxSubtreeFreq);
    }
  }
  let max = 0;
  for (const f of weights.values()) max = Math.max(max, f);
  if (max === 0) return new Map();
  for (const [ch, f] of weights) {
    weights.set(ch, Math.round((f / max) * 10000) / 10000);
  }
  return weights;
}

/**
 * Next-word predictions: bigram continuations of `prevWord` (or curated
 * sentence-openers when there is none), topped up from the most frequent words
 * so the strip is never left half-empty. Words are returned lowercase-keyed but
 * rendered with proper-noun casing; the caller applies sentence casing.
 */
function nextWords(model, prevWord, limit = 3) {
  const out = [];
  const seen = new Set();
  const prev = prevWord ? normalizeToken(prevWord) : null;
  if (prev) seen.add(prev);
  const add = (word) => {
    if (out.length >= limit || !word) return;
    const key = word.toLowerCase();
    if (seen.has(key) || (key.length < 2 && key !== "i")) return;
    seen.add(key);
    const node = model.find(key);
    out.push(renderCandidate(word, node ? node.flags : 0));
  };

  if (prev) {
    for (const bg of model.bigramsFor(prev)) add(bg.word);
  } else {
    for (const starter of SENTENCE_STARTERS) add(starter);
  }
  // Fill any remaining slots from the frequency-ranked word list so a word
  // with few or no bigrams still yields a useful strip.
  for (
    let i = 0;
    out.length < limit && i < TUNING.predictionFallbackScan;
    i++
  ) {
    add(model.topString(i));
  }
  return out;
}

module.exports = {
  TUNING,
  KEY_ADJACENCY,
  KEY_CENTERS,
  SENTENCE_STARTERS,
  AMBIGUOUS_SENTENCE_INITIAL,
  isAdjacent,
  substitutionCost,
  editBudget,
  decode,
  fuzzyMatches,
  completions,
  search,
  applyFirstLetterSurcharge,
  scoreCandidates,
  evaluate,
  nextWords,
  nextCharWeights,
  normalizeToken,
  parseConfusables,
  contextualContraction,
  applyLmRerank,
};
