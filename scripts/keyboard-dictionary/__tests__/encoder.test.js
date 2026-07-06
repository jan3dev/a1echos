const {
  parseUnigrams,
  parseBigrams,
  quantizeFactory,
  buildModel,
  encode,
  FLAG_TERMINAL,
  FLAG_NEVER_CORRECT_TO,
  NON_TERMINAL_WORD_ID,
  LEAF,
} = require("../encoder");

const SMALL_CORPUS = [
  "the 1000000",
  "of 900000",
  "and 800000",
  "to 700000",
  "hello 5000",
  "help 40000",
  "world 30000",
  "word 20000",
  "words 10000",
  "can't 5000",
  "don't 5000",
  "dammit 100",
].join("\n");

const SMALL_BIGRAMS = [
  "the world 5000",
  "hello world 2000",
  "of the 9000",
].join("\n");

const SOURCES = {
  unigramText: SMALL_CORPUS,
  bigramText: SMALL_BIGRAMS,
  contractions: { dont: "don't", im: "I'm" },
  neverCorrectTo: ["dammit", "shite"],
};

describe("parseUnigrams", () => {
  it("strips the BOM, lowercases, filters the alphabet, and keeps max counts", () => {
    const counts = parseUnigrams(
      "﻿The 100\nthe 50\ncafé 10\nabc123 10\nx y 10\nok 7\n\n",
    );
    expect(counts.get("the")).toBe(100);
    expect(counts.get("ok")).toBe(7);
    expect(counts.has("café")).toBe(false);
    expect(counts.has("abc123")).toBe(false);
    expect(counts.has("x y")).toBe(false);
  });

  it("keeps apostrophe and hyphen words", () => {
    const counts = parseUnigrams("don't 10\nwell-known 5");
    expect(counts.get("don't")).toBe(10);
    expect(counts.get("well-known")).toBe(5);
  });
});

describe("parseBigrams", () => {
  it("parses word pairs with counts and skips malformed lines", () => {
    const entries = parseBigrams("of the 100\nbroken\nalso broken here x\n");
    expect(entries).toEqual([["of", "the", 100]]);
  });
});

describe("quantizeFactory", () => {
  it("is monotonic and bounded to 1..255", () => {
    const q = quantizeFactory([1, 10, 100, 1000, 10000]);
    expect(q(1)).toBe(1);
    expect(q(10000)).toBe(255);
    expect(q(10)).toBeGreaterThan(q(1));
    expect(q(1000)).toBeGreaterThan(q(100));
    for (const c of [1, 5, 10, 100, 9999, 10000]) {
      expect(q(c)).toBeGreaterThanOrEqual(1);
      expect(q(c)).toBeLessThanOrEqual(255);
    }
  });
});

describe("buildModel", () => {
  const model = buildModel(SOURCES);

  it("assigns dense wordIds by frequency rank", () => {
    expect(model.ranked[0][0]).toBe("the");
    const ids = model.nodes
      .filter((n) => n.terminal)
      .map((n) => n.wordId)
      .sort((a, b) => a - b);
    expect(ids).toEqual([...ids.keys()]);
    expect(ids.length).toBe(model.ranked.length);
  });

  it("removes contraction typed forms from the unigram set", () => {
    const words = new Set(model.ranked.map(([w]) => w));
    expect(words.has("dont")).toBe(false);
    expect(words.has("don't")).toBe(true);
  });

  it("keeps never-correct-to words in the trie with the flag set", () => {
    const flagged = model.nodes.filter(
      (n) => (n.flags & FLAG_NEVER_CORRECT_TO) !== 0,
    );
    expect(flagged.length).toBe(2);
    for (const node of flagged) {
      expect(node.flags & FLAG_TERMINAL).toBe(FLAG_TERMINAL);
    }
    const words = new Set(model.ranked.map(([w]) => w));
    expect(words.has("shite")).toBe(true);
  });

  it("satisfies radix trie invariants", () => {
    model.nodes.forEach((node, i) => {
      if (i > 0) expect(node.label.length).toBeGreaterThan(0);
      if (node.firstChildIndex !== LEAF) {
        expect(node.childCount).toBeGreaterThan(0);
        const firstBytes = [];
        for (let c = 0; c < node.childCount; c++) {
          const child = model.nodes[node.firstChildIndex + c];
          firstBytes.push(child.label[0]);
        }
        expect([...firstBytes].sort()).toEqual(firstBytes);
        expect(new Set(firstBytes).size).toBe(firstBytes.length);
      } else {
        expect(node.childCount).toBe(0);
      }
      if (!node.terminal) {
        expect(node.wordId).toBe(NON_TERMINAL_WORD_ID);
        expect(node.freq).toBe(0);
      }
    });
  });

  it("keeps only bigrams whose words are both encoded", () => {
    for (const bg of model.bigrams) {
      expect(bg.prevId).toBeLessThan(model.ranked.length);
      expect(bg.nextId).toBeLessThan(model.topStrings.length);
      expect(bg.freq).toBeGreaterThanOrEqual(1);
    }
    expect(model.bigrams.length).toBe(3);
  });

  it("rejects invalid contraction typed forms", () => {
    expect(() =>
      buildModel({ ...SOURCES, contractions: { "bad word": "x" } }),
    ).toThrow(/Invalid contraction/);
    expect(() => buildModel({ ...SOURCES, contractions: { ok: "" } })).toThrow(
      /Invalid contraction/,
    );
  });
});

describe("encode", () => {
  it("is deterministic (byte-identical across runs)", () => {
    const a = encode(SOURCES);
    const b = encode(SOURCES);
    expect(a.equals(b)).toBe(true);
  });

  it("writes the ECHD magic and version", () => {
    const buf = encode(SOURCES);
    expect(buf.toString("ascii", 0, 4)).toBe("ECHD");
    expect(buf.readUInt16LE(4)).toBe(1);
    expect(buf.readUInt16LE(6)).toBe(0x03);
  });
});
