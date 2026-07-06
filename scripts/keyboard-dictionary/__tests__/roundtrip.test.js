const fs = require("node:fs");
const { encode } = require("../encoder");
const { decode, evaluate, nextWords, search } = require("../decoder");
const { readSources, OUTPUT } = require("../build");

const SOURCES = {
  unigramText: [
    "the 1000000",
    "of 900000",
    "and 800000",
    "hello 50000",
    "help 40000",
    "world 30000",
    "word 20000",
    "words 10000",
    "can't 5000",
    "don't 5000",
  ].join("\n"),
  bigramText: ["the world 5000", "hello world 2000", "of the 9000"].join("\n"),
  contractions: { dont: "don't", im: "I'm" },
  neverCorrectTo: [],
};

describe("decode roundtrip (small corpus)", () => {
  const model = decode(encode(SOURCES));

  it("reconstructs the exact word list with rank-ordered ids", () => {
    const decoded = [...model.words()].sort((a, b) => a.wordId - b.wordId);
    expect(decoded.map((w) => w.word)).toEqual([
      "the",
      "of",
      "and",
      "hello",
      "help",
      "world",
      "word",
      "words",
      "can't",
      "don't",
    ]);
    expect(decoded[0].freq).toBe(255);
  });

  it("finds exact words and rejects non-words", () => {
    expect(model.find("hello")).not.toBeNull();
    expect(model.find("can't")).not.toBeNull();
    expect(model.find("hell")).toBeNull();
    expect(model.find("helloo")).toBeNull();
  });

  it("looks up bigrams sorted by frequency", () => {
    const nexts = model.bigramsFor("the").map((bg) => bg.word);
    expect(nexts).toEqual(["world"]);
    expect(nextWords(model, "of")).toEqual(["the"]);
    expect(model.bigramsFor("hello").map((bg) => bg.word)).toEqual(["world"]);
  });

  it("decodes contractions", () => {
    expect(model.contractions.get("dont")).toBe("don't");
    expect(model.contractions.get("im")).toBe("I'm");
  });

  it("rejects corrupted payloads via CRC", () => {
    const buf = Buffer.from(encode(SOURCES));
    buf[buf.length - 1] ^= 0xff;
    expect(() => decode(buf)).toThrow(/CRC/);
  });

  it("rejects bad magic and versions", () => {
    const buf = Buffer.from(encode(SOURCES));
    buf.write("NOPE", 0, "ascii");
    expect(() => decode(buf)).toThrow(/magic/);
  });
});

describe("committed artifact", () => {
  it("is byte-identical to a fresh encode of the vendored sources", () => {
    const committed = fs.readFileSync(OUTPUT);
    const fresh = encode(readSources());
    expect(fresh.equals(committed)).toBe(true);
  });
});

describe("reference engine golden vectors (full dictionary)", () => {
  const model = decode(fs.readFileSync(OUTPUT));

  const autocorrects = [
    ["teh", "the"],
    ["hte", "the"],
    ["helo", "hello"],
    ["wrold", "world"],
    ["recieve", "receive"],
    ["wich", "which"],
    ["peice", "piece"],
    ["adress", "address"],
    ["definately", "definitely"],
    ["tomorow", "tomorrow"],
    ["alot", "a lot"],
    ["dont", "don't"],
    ["im", "I'm"],
    ["thats", "that's"],
    ["emial", "email"],
    ["i", "I"],
    ["imnot", "I'm not"],
    ["cant", "can't"],
    ["wont", "won't"],
    ["mondya", "Monday"],
  ];
  it.each(autocorrects)("autocorrects %s -> %s", (typed, expected) => {
    const r = evaluate(model, typed, null);
    expect(r.topIsCorrection).toBe(true);
    expect(r.replacement).toBe(expected);
    expect(r.verbatim).toBe(typed);
  });

  const neverAutocorrected = [
    "the", // valid word
    "well", // valid word (never sentence-initial-contracted to "we'll")
    "its", // ambiguous contraction: lowercase mid-sentence stays untouched
    "ok", // informal vocabulary
    "sats", // domain vocabulary
    "bitcoin",
    "gonna",
    "TEH", // ALL-CAPS acronym
    "fuk", // short typed, only rare/never-correct-to neighbors
    "sata", // completion-driven replacement of a short prefix
    "well-known", // hyphenated
    "a", // single char
  ];
  it.each(neverAutocorrected)("never autocorrects %s", (typed) => {
    expect(evaluate(model, typed, null).topIsCorrection).toBe(false);
  });

  it("offers apostrophe restoration as the top suggestion for hasnt-like words", () => {
    expect(evaluate(model, "wasnt", null).replacement).toBe("wasn't");
    expect(evaluate(model, "hell", null).candidates).toContain("he'll");
  });

  it("applies ambiguous contractions only sentence-initially with a capital", () => {
    expect(evaluate(model, "Its", null).replacement).toBe("It's");
    expect(evaluate(model, "Ill", null).replacement).toBe("I'll");
    expect(evaluate(model, "Lets", null).replacement).toBe("Let's");
    expect(evaluate(model, "its", null).topIsCorrection).toBe(false);
    expect(evaluate(model, "Its", "love").topIsCorrection).toBe(false);
  });

  it("renders proper nouns title-case in candidates and predictions", () => {
    expect(evaluate(model, "franve", null).candidates[0]).toBe("France");
    const r = evaluate(model, "mondya", null);
    expect(r.replacement).toBe("Monday");
    expect(model.find("france")).not.toBeNull();
  });

  it("self-corrects lowercase proper nouns to title case", () => {
    for (const [typed, expected] of [
      ["france", "France"],
      ["monday", "Monday"],
      ["google", "Google"],
    ]) {
      const r = evaluate(model, typed, null);
      expect(r.topIsCorrection).toBe(true);
      expect(r.replacement).toBe(expected);
    }
    // Already-cased forms and blacklisted pairs stay untouched.
    expect(evaluate(model, "France", null).topIsCorrection).toBe(false);
    expect(
      evaluate(model, "france", null, {
        blacklisted: (t, c) => t === "france" && c === "france",
      }).topIsCorrection,
    ).toBe(false);
  });

  it("returns nothing for digit-bearing tokens", () => {
    expect(evaluate(model, "jan3", null).candidates).toEqual([]);
  });

  it("never suggests profanity for near-miss input", () => {
    const words = evaluate(model, "fuk", null).candidates;
    expect(words).not.toContain("fuck");
    const shti = evaluate(model, "shti", null).candidates;
    expect(shti).not.toContain("shit");
  });

  it("still recognizes profanity typed exactly (no correction)", () => {
    expect(evaluate(model, "fuck", null).topIsCorrection).toBe(false);
    expect(model.find("fuck")).not.toBeNull();
  });

  it("honors the knownValid veto (UITextChecker / user lexicon)", () => {
    const r = evaluate(model, "jan3corp".replace("3", "e"), null, {
      knownValid: true,
    });
    expect(r.topIsCorrection).toBe(false);
  });

  it("honors the blacklist (learned reverts)", () => {
    const denied = evaluate(model, "teh", null, {
      blacklisted: (typed, top) => typed === "teh" && top === "the",
    });
    expect(denied.topIsCorrection).toBe(false);
    const contractionDenied = evaluate(model, "dont", null, {
      blacklisted: (typed, top) => typed === "dont" && top === "don't",
    });
    expect(contractionDenied.topIsCorrection).toBe(false);
  });

  it("boosts candidates matching the previous word's bigrams", () => {
    expect(evaluate(model, "teh", "was").replacement).toBe("the");
    expect(nextWords(model, "thank")[0]).toBe("you");
    expect(nextWords(model, "i").length).toBeGreaterThan(0);
  });

  it("completes prefixes while typing", () => {
    expect(evaluate(model, "keyb", null).candidates[0]).toBe("keyboard");
    expect(evaluate(model, "th", null).candidates).toContain("the");
  });

  it("stays fast enough for the keystroke path", () => {
    const words = ["teh", "keyboad", "definately", "th", "somthing"];
    const start = Date.now();
    for (let i = 0; i < 20; i++) {
      for (const w of words) search(model, w);
    }
    const perLookup = (Date.now() - start) / (20 * words.length);
    // JS reference; the native engines are far faster. Generous CI margin.
    expect(perLookup).toBeLessThan(50);
  });
});
