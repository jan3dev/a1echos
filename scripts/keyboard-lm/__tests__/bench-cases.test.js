"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  previewCase,
  evalCase,
  loadDictionary,
} = require("../bench-e2e");

const CASES_PATH = path.join(__dirname, "../bench/cases.json");
const CORPUS_PATH = path.join(__dirname, "../bench/typing-eval.txt");

const SLICES = new Set([
  "confusable-contract",
  "confusable-literal",
  "homophone",
  "near-tie",
  "register-casual",
  "dont-flip",
]);

function loadCases() {
  return JSON.parse(fs.readFileSync(CASES_PATH, "utf8"));
}

describe("keyboard-lm bench cases.json", () => {
  const doc = loadCases();

  test("has pairwise and e2e arrays", () => {
    expect(Array.isArray(doc.pairwise)).toBe(true);
    expect(Array.isArray(doc.e2e)).toBe(true);
    expect(doc.pairwise.length).toBeGreaterThanOrEqual(80);
    expect(doc.e2e.length).toBeGreaterThanOrEqual(25);
  });

  test("ids are unique across the whole file", () => {
    const ids = [...doc.pairwise, ...doc.e2e].map((c) => c.id);
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(
      true,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("pairwise items have the required shape", () => {
    for (const c of doc.pairwise) {
      expect(SLICES.has(c.slice)).toBe(true);
      expect(typeof c.leftContext).toBe("string");
      expect(typeof c.gold).toBe("string");
      expect(c.gold.length).toBeGreaterThan(0);
      expect(Array.isArray(c.distractors)).toBe(true);
      expect(c.distractors.length).toBeGreaterThan(0);
      expect(c.distractors).not.toContain(c.gold);
      expect(new Set(c.distractors).size).toBe(c.distractors.length);
      expect(c.distractors.every((w) => typeof w === "string" && w.length > 0)).toBe(
        true,
      );
    }
  });

  test("e2e items have the required shape", () => {
    for (const c of doc.e2e) {
      expect(SLICES.has(c.slice)).toBe(true);
      expect(typeof c.typed).toBe("string");
      expect(c.typed.length).toBeGreaterThan(0);
      expect(typeof c.leftContext).toBe("string");
      if (c.prevWord != null) expect(typeof c.prevWord).toBe("string");
      const hasExpect =
        Object.prototype.hasOwnProperty.call(c, "expectReplacement") ||
        Object.prototype.hasOwnProperty.call(c, "expectTopIsCorrection") ||
        Object.prototype.hasOwnProperty.call(c, "expectTopCandidate");
      expect(hasExpect).toBe(true);
      if (Object.prototype.hasOwnProperty.call(c, "expectTopCandidate")) {
        expect(typeof c.expectTopCandidate).toBe("string");
      }
      if (Object.prototype.hasOwnProperty.call(c, "expectTopIsCorrection")) {
        expect(typeof c.expectTopIsCorrection).toBe("boolean");
      }
    }
  });

  test("covers every advertised slice in both suites", () => {
    const pairwiseSlices = new Set(doc.pairwise.map((c) => c.slice));
    const e2eSlices = new Set(doc.e2e.map((c) => c.slice));
    for (const sl of SLICES) {
      expect(pairwiseSlices.has(sl)).toBe(true);
    }
    expect(e2eSlices.has("confusable-contract")).toBe(true);
    expect(e2eSlices.has("confusable-literal")).toBe(true);
    expect(e2eSlices.has("near-tie")).toBe(true);
    expect(e2eSlices.has("dont-flip")).toBe(true);
  });
});

describe("keyboard-lm typing-eval corpus", () => {
  test("has enough original typing-register lines", () => {
    const lines = fs
      .readFileSync(CORPUS_PATH, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    expect(lines.length).toBeGreaterThanOrEqual(100);
    expect(new Set(lines).size).toBe(lines.length);
  });
});

describe("bench-e2e helper", () => {
  const model = loadDictionary();

  test("preview records confusable words and eval honors LM scores", () => {
    const c = {
      id: "ill-literal",
      typed: "Ill",
      prevWord: null,
      leftContext: "The doctor examined several",
    };
    const preview = previewCase(model, c);
    expect(preview.words).toEqual(["Ill", "I'll"]);

    const contracts = evalCase(model, {
      ...c,
      scores: { Ill: -4.0, "I'll": -0.2 },
    });
    expect(contracts.replacement).toBe("I'll");
    expect(contracts.topIsCorrection).toBe(true);

    const standsDown = evalCase(model, {
      ...c,
      scores: { Ill: -0.2, "I'll": -4.0 },
    });
    expect(standsDown.replacement).toBe(null);
    expect(standsDown.topIsCorrection).toBe(false);
  });

  test("preview is empty when evaluate never consults the LM", () => {
    const preview = previewCase(model, {
      id: "youre",
      typed: "youre",
      prevWord: "think",
      leftContext: "I think",
    });
    expect(preview.words).toEqual([]);

    const out = evalCase(model, {
      id: "youre",
      typed: "youre",
      prevWord: "think",
      leftContext: "I think",
      scores: {},
    });
    expect(out.replacement).toBe("you're");
    expect(out.topIsCorrection).toBe(true);
  });
});
