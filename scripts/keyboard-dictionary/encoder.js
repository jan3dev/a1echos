"use strict";

/**
 * Encoder for the "ECHD" v1 keyboard dictionary binary.
 *
 * Layout (all little-endian):
 *   HEADER (64 bytes)
 *     0  char[4] magic "ECHD"
 *     4  u16 version (1)
 *     6  u16 flags (bit0 = bigrams present, bit1 = contractions present)
 *     8  u32 nodeCount
 *     12 u32 wordCount
 *     16 u32 nodesOffset
 *     20 u32 labelsOffset
 *     24 u32 labelsLength
 *     28 u32 topStringsOffset
 *     32 u32 topStringsCount
 *     36 u32 bigramsOffset
 *     40 u32 bigramCount
 *     44 u32 contractionsOffset
 *     48 u32 contractionCount
 *     52 u32 crc32 of all bytes after the header
 *     56 u8[8] reserved (zero)
 *   NODES (16 bytes each, path-compressed trie, nodes[0] = root)
 *     0  u32 firstChildIndex (0xFFFFFFFF = leaf; children contiguous,
 *          sorted by first label byte)
 *     4  u32 labelOffset (into labels section)
 *     8  u32 packed: bits 0..23 wordId (0xFFFFFF = non-terminal),
 *          bits 24..31 nodeFlags (bit0 terminal, bit1 neverAutocorrectTo)
 *     12 u8 labelLen
 *     13 u8 childCount
 *     14 u8 freq (log-quantized 1..255, 0 for non-terminal)
 *     15 u8 maxSubtreeFreq (max terminal freq in this subtree, incl. self)
 *   LABELS: concatenated UTF-8 label bytes (alphabet a-z ' -)
 *   TOP STRINGS: u32 offsets[count + 1] then concatenated UTF-8 pool.
 *     wordId = frequency rank, so ids 0..count-1 are the most frequent words.
 *   BIGRAMS (8 bytes each, sorted by prevId asc then freq desc then nextId asc)
 *     u24 prevId, u24 nextId, u8 freq, u8 pad
 *   CONTRACTIONS (6 bytes each, sorted by typed form) then UTF-8 pool
 *     u16 typedOffset, u8 typedLen, u16 replOffset, u8 replLen
 */

const MAGIC = "ECHD";
const VERSION = 1;
const HEADER_SIZE = 64;
const NODE_SIZE = 16;
const LEAF = 0xffffffff;
const NON_TERMINAL_WORD_ID = 0xffffff;
const FLAG_TERMINAL = 0x01;
const FLAG_NEVER_CORRECT_TO = 0x02;
// Words that are usually capitalized (countries, cities, languages, brands,
// days/months) — candidates and predictions render them title-case.
const FLAG_PROPER_NOUN = 0x04;
const TOP_STRINGS_CAP = 16384;
const MAX_BIGRAMS = 100000;
const WORD_RE = /^[a-z'-]+$/;

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function parseUnigrams(text) {
  const counts = new Map();
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/^﻿/, "").trim();
    if (!line) continue;
    const sep = line.lastIndexOf(" ");
    if (sep <= 0) continue;
    const word = line.slice(0, sep).toLowerCase();
    const count = Number(line.slice(sep + 1));
    if (!WORD_RE.test(word) || word.length > 32) continue;
    if (!Number.isFinite(count) || count <= 0) continue;
    counts.set(word, Math.max(counts.get(word) ?? 0, count));
  }
  return counts;
}

function parseBigrams(text) {
  const entries = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/^﻿/, "").trim();
    if (!line) continue;
    const parts = line.split(" ");
    if (parts.length !== 3) continue;
    const [a, b, rawCount] = parts;
    const count = Number(rawCount);
    if (!Number.isFinite(count) || count <= 0) continue;
    entries.push([a.toLowerCase(), b.toLowerCase(), count]);
  }
  return entries;
}

function quantizeFactory(counts) {
  let min = Infinity;
  let max = -Infinity;
  for (const c of counts) {
    if (c < min) min = c;
    if (c > max) max = c;
  }
  const lnMin = Math.log(min);
  const range = Math.log(max) - lnMin;
  return (count) => {
    if (range <= 0) return 255;
    const q = Math.round((255 * (Math.log(count) - lnMin)) / range);
    return Math.max(1, Math.min(255, q));
  };
}

function makeNode(label) {
  return {
    label,
    children: new Map(),
    terminal: false,
    wordId: NON_TERMINAL_WORD_ID,
    freq: 0,
    flags: 0,
  };
}

function markTerminal(node, wordId, freq, flags) {
  node.terminal = true;
  node.wordId = wordId;
  node.freq = freq;
  node.flags = FLAG_TERMINAL | flags;
}

function insertWord(root, word, wordId, freq, flags) {
  let node = root;
  let i = 0;
  for (;;) {
    if (i === word.length) {
      markTerminal(node, wordId, freq, flags);
      return;
    }
    const child = node.children.get(word[i]);
    if (!child) {
      const leaf = makeNode(word.slice(i));
      markTerminal(leaf, wordId, freq, flags);
      node.children.set(word[i], leaf);
      return;
    }
    const label = child.label;
    let k = 0;
    while (
      k < label.length &&
      i + k < word.length &&
      label[k] === word[i + k]
    ) {
      k++;
    }
    if (k === label.length) {
      node = child;
      i += k;
      continue;
    }
    const mid = makeNode(label.slice(0, k));
    child.label = label.slice(k);
    mid.children.set(child.label[0], child);
    node.children.set(word[i], mid);
    if (i + k === word.length) {
      markTerminal(mid, wordId, freq, flags);
    } else {
      const leaf = makeNode(word.slice(i + k));
      markTerminal(leaf, wordId, freq, flags);
      mid.children.set(leaf.label[0], leaf);
    }
    return;
  }
}

function computeMaxSubtreeFreq(node) {
  let max = node.freq;
  for (const child of node.children.values()) {
    max = Math.max(max, computeMaxSubtreeFreq(child));
  }
  node.maxSubtreeFreq = max;
  return max;
}

function flattenTrie(root) {
  computeMaxSubtreeFreq(root);
  const nodes = [root];
  for (let qi = 0; qi < nodes.length; qi++) {
    const node = nodes[qi];
    const kids = [...node.children.values()].sort((a, b) =>
      a.label < b.label ? -1 : 1,
    );
    node.childCount = kids.length;
    node.firstChildIndex = kids.length ? nodes.length : LEAF;
    nodes.push(...kids);
  }
  return nodes;
}

function buildModel(sources) {
  const {
    unigramText,
    bigramText = "",
    contractions = {},
    neverCorrectTo = [],
    properNouns = [],
  } = sources;

  const contractionEntries = Object.entries(contractions)
    .map(([typed, repl]) => [typed.toLowerCase(), repl])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  for (const [typed, repl] of contractionEntries) {
    if (!WORD_RE.test(typed) || typed.length < 2) {
      throw new Error(`Invalid contraction typed form: ${typed}`);
    }
    if (typeof repl !== "string" || !repl) {
      throw new Error(`Invalid contraction replacement for: ${typed}`);
    }
  }

  const counts = parseUnigrams(unigramText);
  // Contraction typed forms ("dont", "im", ...) are misspellings, not words;
  // if the corpus contains them they would block autocorrect entirely.
  for (const [typed] of contractionEntries) counts.delete(typed);

  const neverSet = new Set(
    neverCorrectTo.map((w) => w.toLowerCase()).filter((w) => WORD_RE.test(w)),
  );
  const properSet = new Set(
    properNouns.map((w) => w.toLowerCase()).filter((w) => WORD_RE.test(w)),
  );
  let minCount = Infinity;
  for (const c of counts.values()) minCount = Math.min(minCount, c);
  for (const w of neverSet) {
    // Keep offensive words recognizable (typed exactly => valid, never
    // red-flagged/corrected) even when the corpus lacks them.
    if (!counts.has(w)) counts.set(w, minCount);
  }
  for (const w of properSet) {
    if (!counts.has(w)) counts.set(w, minCount);
  }

  const ranked = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1),
  );
  if (ranked.length === 0) throw new Error("No words to encode");
  if (ranked.length >= NON_TERMINAL_WORD_ID) {
    throw new Error("Word count exceeds u24 wordId space");
  }

  const quantize = quantizeFactory(counts.values());
  const wordIds = new Map();
  const root = makeNode("");
  ranked.forEach(([word, count], wordId) => {
    wordIds.set(word, wordId);
    const flags =
      (neverSet.has(word) ? FLAG_NEVER_CORRECT_TO : 0) |
      (properSet.has(word) ? FLAG_PROPER_NOUN : 0);
    insertWord(root, word, wordId, quantize(count), flags);
  });
  const nodes = flattenTrie(root);

  const topStringsCount = Math.min(ranked.length, TOP_STRINGS_CAP);
  const topStrings = ranked.slice(0, topStringsCount).map(([word]) => word);

  let bigrams = [];
  if (bigramText) {
    const raw = parseBigrams(bigramText);
    const eligible = [];
    for (const [a, b, count] of raw) {
      const prevId = wordIds.get(a);
      const nextId = wordIds.get(b);
      if (prevId === undefined || nextId === undefined) continue;
      if (nextId >= topStringsCount) continue;
      eligible.push({ prevId, nextId, count });
    }
    eligible.sort(
      (a, b) => b.count - a.count || a.prevId - b.prevId || a.nextId - b.nextId,
    );
    const kept = eligible.slice(0, MAX_BIGRAMS);
    if (kept.length) {
      const quantizeBigram = quantizeFactory(kept.map((e) => e.count));
      bigrams = kept
        .map((e) => ({ ...e, freq: quantizeBigram(e.count) }))
        .sort(
          (a, b) =>
            a.prevId - b.prevId || b.freq - a.freq || a.nextId - b.nextId,
        );
    }
  }

  return { nodes, ranked, topStrings, bigrams, contractionEntries };
}

function encodeModel(model) {
  const { nodes, ranked, topStrings, bigrams, contractionEntries } = model;

  const labelChunks = [];
  let labelsLength = 0;
  for (const node of nodes) {
    const bytes = Buffer.from(node.label, "utf8");
    if (bytes.length > 255) throw new Error(`Label too long: ${node.label}`);
    if (node.childCount > 255) throw new Error("Too many children");
    node.labelOffset = labelsLength;
    node.labelLen = bytes.length;
    labelChunks.push(bytes);
    labelsLength += bytes.length;
  }
  const labelsBuf = Buffer.concat(labelChunks, labelsLength);

  const nodesBuf = Buffer.alloc(nodes.length * NODE_SIZE);
  nodes.forEach((node, i) => {
    const off = i * NODE_SIZE;
    nodesBuf.writeUInt32LE(node.firstChildIndex >>> 0, off);
    nodesBuf.writeUInt32LE(node.labelOffset, off + 4);
    const packed = ((node.flags & 0xff) << 24) | (node.wordId & 0xffffff);
    nodesBuf.writeUInt32LE(packed >>> 0, off + 8);
    nodesBuf.writeUInt8(node.labelLen, off + 12);
    nodesBuf.writeUInt8(node.childCount, off + 13);
    nodesBuf.writeUInt8(node.terminal ? node.freq : 0, off + 14);
    nodesBuf.writeUInt8(node.maxSubtreeFreq, off + 15);
  });

  const topOffsets = Buffer.alloc(4 * (topStrings.length + 1));
  const topChunks = [];
  let topPoolLength = 0;
  topStrings.forEach((word, i) => {
    topOffsets.writeUInt32LE(topPoolLength, 4 * i);
    const bytes = Buffer.from(word, "utf8");
    topChunks.push(bytes);
    topPoolLength += bytes.length;
  });
  topOffsets.writeUInt32LE(topPoolLength, 4 * topStrings.length);
  const topBuf = Buffer.concat(
    [topOffsets, ...topChunks],
    topOffsets.length + topPoolLength,
  );

  const bigramsBuf = Buffer.alloc(bigrams.length * 8);
  bigrams.forEach((bg, i) => {
    const off = i * 8;
    bigramsBuf.writeUIntLE(bg.prevId, off, 3);
    bigramsBuf.writeUIntLE(bg.nextId, off + 3, 3);
    bigramsBuf.writeUInt8(bg.freq, off + 6);
    bigramsBuf.writeUInt8(0, off + 7);
  });

  const contractionRecords = Buffer.alloc(contractionEntries.length * 6);
  const contractionChunks = [];
  let contractionPoolLength = 0;
  contractionEntries.forEach(([typed, repl], i) => {
    const typedBytes = Buffer.from(typed, "utf8");
    const replBytes = Buffer.from(repl, "utf8");
    const off = i * 6;
    contractionRecords.writeUInt16LE(contractionPoolLength, off);
    contractionRecords.writeUInt8(typedBytes.length, off + 2);
    contractionChunks.push(typedBytes);
    contractionPoolLength += typedBytes.length;
    contractionRecords.writeUInt16LE(contractionPoolLength, off + 3);
    contractionRecords.writeUInt8(replBytes.length, off + 5);
    contractionChunks.push(replBytes);
    contractionPoolLength += replBytes.length;
  });
  if (contractionPoolLength > 0xffff) {
    throw new Error("Contraction pool exceeds u16 offsets");
  }
  const contractionsBuf = Buffer.concat(
    [contractionRecords, ...contractionChunks],
    contractionRecords.length + contractionPoolLength,
  );

  const nodesOffset = HEADER_SIZE;
  const labelsOffset = nodesOffset + nodesBuf.length;
  const topStringsOffset = labelsOffset + labelsBuf.length;
  const bigramsOffset = topStringsOffset + topBuf.length;
  const contractionsOffset = bigramsOffset + bigramsBuf.length;
  const body = Buffer.concat([
    nodesBuf,
    labelsBuf,
    topBuf,
    bigramsBuf,
    contractionsBuf,
  ]);

  const header = Buffer.alloc(HEADER_SIZE);
  header.write(MAGIC, 0, "ascii");
  header.writeUInt16LE(VERSION, 4);
  const flags =
    (bigrams.length ? 0x01 : 0) | (contractionEntries.length ? 0x02 : 0);
  header.writeUInt16LE(flags, 6);
  header.writeUInt32LE(nodes.length, 8);
  header.writeUInt32LE(ranked.length, 12);
  header.writeUInt32LE(nodesOffset, 16);
  header.writeUInt32LE(labelsOffset, 20);
  header.writeUInt32LE(labelsBuf.length, 24);
  header.writeUInt32LE(topStringsOffset, 28);
  header.writeUInt32LE(topStrings.length, 32);
  header.writeUInt32LE(bigramsOffset, 36);
  header.writeUInt32LE(bigrams.length, 40);
  header.writeUInt32LE(contractionsOffset, 44);
  header.writeUInt32LE(contractionEntries.length, 48);
  header.writeUInt32LE(crc32(body), 52);

  return Buffer.concat([header, body]);
}

function encode(sources) {
  return encodeModel(buildModel(sources));
}

module.exports = {
  MAGIC,
  VERSION,
  HEADER_SIZE,
  NODE_SIZE,
  LEAF,
  NON_TERMINAL_WORD_ID,
  FLAG_TERMINAL,
  FLAG_NEVER_CORRECT_TO,
  FLAG_PROPER_NOUN,
  TOP_STRINGS_CAP,
  MAX_BIGRAMS,
  WORD_RE,
  crc32,
  parseUnigrams,
  parseBigrams,
  quantizeFactory,
  buildModel,
  encodeModel,
  encode,
};
