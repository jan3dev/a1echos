const fs = require("node:fs");
const path = require("node:path");
const {
  decode,
  evaluate,
  nextWords,
  parseConfusables,
  contextualContraction,
} = require("../decoder");

/**
 * Golden-vector suite: pins the reference engine's end-to-end behavior against
 * the SHIPPED dictionary artifact, so every tuning or algorithm change shows
 * up as an explicit fixture diff. The same vectors feed
 * `generate-parity-fixtures.js`, which emits fixtures for the native
 * (Swift/Kotlin) mirrors.
 *
 * When a change intentionally alters behavior, regenerate expectations with
 * `node scripts/keyboard-dictionary/generate-parity-fixtures.js --update` and
 * review the fixture diff like any other code change.
 */

const DICTIONARY = path.join(
  __dirname,
  "../../../data/keyboard-dictionary/keyboard_dictionary.echd",
);
const VECTORS = require("./fixtures/golden-vectors.json");

describe("golden vectors (shipped dictionary)", () => {
  const model = decode(fs.readFileSync(DICTIONARY));

  describe("evaluate", () => {
    it.each(
      VECTORS.evaluate.map((v) => [
        v.prevWord ? `${v.prevWord} | ${v.typed}` : v.typed,
        v,
      ]),
    )("%s", (_label, v) => {
      const result = evaluate(model, v.typed, v.prevWord ?? null, {
        touchPoints: v.touches ?? null,
      });
      expect({
        candidates: result.candidates,
        topIsCorrection: result.topIsCorrection,
        replacement: result.replacement,
      }).toEqual(v.expect);
    });

    it("sets verbatim to the typed word exactly when correcting", () => {
      const corrected = evaluate(model, "Teh");
      expect(corrected.topIsCorrection).toBe(true);
      expect(corrected.verbatim).toBe("Teh");
      const kept = evaluate(model, "hello");
      expect(kept.topIsCorrection).toBe(false);
      expect(kept.verbatim).toBeNull();
    });
  });

  describe("touch model", () => {
    it("a touch buffer of the wrong length degrades to the static model", () => {
      const noTouch = evaluate(model, "cae");
      const stale = evaluate(model, "cae", null, {
        touchPoints: [{ x: 3.3, y: 0.6 }],
      });
      expect(stale).toEqual(noTouch);
    });

    it("touch evidence flips ranking that adjacency alone cannot", () => {
      const noTouch = evaluate(model, "cae");
      const nearR = evaluate(model, "cae", null, {
        touchPoints: [null, null, { x: 3.3, y: 0.6 }],
      });
      expect(noTouch.replacement).toBe("ace");
      expect(nearR.replacement).toBe("car");
    });
  });

  describe("evaluate gates", () => {
    it("returns nothing for empty or over-long input", () => {
      expect(evaluate(model, "").candidates).toEqual([]);
      expect(evaluate(model, "a".repeat(33)).candidates).toEqual([]);
    });

    it("abstains entirely on digit-containing tokens", () => {
      const result = evaluate(model, "he11o");
      expect(result.candidates).toEqual([]);
      expect(result.topIsCorrection).toBe(false);
    });

    it("knownValid (platform lexicon) vetoes the autocorrect", () => {
      const withoutVeto = evaluate(model, "teh");
      expect(withoutVeto.topIsCorrection).toBe(true);
      const withVeto = evaluate(model, "teh", null, { knownValid: true });
      expect(withVeto.topIsCorrection).toBe(false);
      expect(withVeto.candidates).toEqual(withoutVeto.candidates);
    });

    it("a blacklisted pair (learned revert) vetoes the autocorrect", () => {
      const result = evaluate(model, "teh", null, {
        blacklisted: (typed, corrected) =>
          typed === "teh" && corrected === "the",
      });
      expect(result.topIsCorrection).toBe(false);
    });

    it("the blacklist also silences the shortcut corrections", () => {
      const always = () => true;
      expect(
        evaluate(model, "i", null, { blacklisted: always }).topIsCorrection,
      ).toBe(false);
      expect(
        evaluate(model, "Its", null, { blacklisted: always }).topIsCorrection,
      ).toBe(false);
      expect(
        evaluate(model, "dont", null, { blacklisted: always }).topIsCorrection,
      ).toBe(false);
      expect(
        evaluate(model, "france", null, { blacklisted: always })
          .topIsCorrection,
      ).toBe(false);
    });

    it("never offers profanity (never-correct-to) as a fuzzy candidate", () => {
      // "fuck" carries FLAG_NEVER_CORRECT_TO: reachable only by exact typing.
      const result = evaluate(model, "fuk");
      expect(result.candidates).not.toContain("fuck");
    });
  });

  describe("contextual confusables", () => {
    const confusables = parseConfusables(
      require("../../../data/keyboard-dictionary/confusables.json"),
    );

    it("rewrites ill -> I'll before a triggering verb", () => {
      expect(contextualContraction(confusables, "ill", "be")).toBe("I'll");
      expect(contextualContraction(confusables, "ill", "go")).toBe("I'll");
      expect(contextualContraction(confusables, "ill", "call")).toBe("I'll");
    });

    it("leaves ill alone before a non-trigger (adjective reading)", () => {
      expect(contextualContraction(confusables, "ill", "health")).toBeNull();
      expect(contextualContraction(confusables, "ill", "effects")).toBeNull();
      expect(contextualContraction(confusables, "ill", "patients")).toBeNull();
    });

    it("rewrites id -> I'd before a triggering word", () => {
      expect(contextualContraction(confusables, "id", "like")).toBe("I'd");
      expect(contextualContraction(confusables, "id", "rather")).toBe("I'd");
    });

    it("rewrites its/lets/hell/shell before their triggers", () => {
      expect(contextualContraction(confusables, "its", "been")).toBe("it's");
      expect(contextualContraction(confusables, "its", "a")).toBe("it's");
      expect(contextualContraction(confusables, "lets", "see")).toBe("let's");
      expect(contextualContraction(confusables, "hell", "be")).toBe("he'll");
      expect(contextualContraction(confusables, "shell", "be")).toBe("she'll");
    });

    it("leaves the risky readings alone", () => {
      // possessive "its", "he lets go of", "shell out", excluded "were"
      expect(contextualContraction(confusables, "its", "own")).toBeNull();
      expect(contextualContraction(confusables, "its", "name")).toBeNull();
      expect(contextualContraction(confusables, "lets", "go")).toBeNull();
      expect(contextualContraction(confusables, "shell", "out")).toBeNull();
      expect(contextualContraction(confusables, "were", "going")).toBeNull();
    });

    it("never fires for a non-confusable or capitalized word", () => {
      expect(contextualContraction(confusables, "well", "be")).toBeNull();
      expect(contextualContraction(confusables, "Ill", "be")).toBeNull();
      expect(contextualContraction(confusables, "ill", "")).toBeNull();
      expect(contextualContraction(confusables, "", "be")).toBeNull();
    });

    it("respects the blacklist (a reverted pair never re-fires)", () => {
      const bl = (typed, corrected) => typed === "ill" && corrected === "i'll";
      expect(contextualContraction(confusables, "ill", "be", bl)).toBeNull();
    });
  });

  describe("nextWords", () => {
    it.each(VECTORS.nextWords.map((v) => [v.prevWord, v]))(
      "%s",
      (_label, v) => {
        expect(nextWords(model, v.prevWord)).toEqual(v.expect);
      },
    );

    it("falls back to frequent words for an unknown previous word", () => {
      // No bigrams for an unknown word, so the strip fills from the
      // frequency-ranked list rather than being left empty.
      const predictions = nextWords(model, "qzxqzx");
      expect(predictions.length).toBe(3);
      expect(predictions).not.toContain("qzxqzx");
    });

    it("offers curated openers when there is no previous word", () => {
      const starters = nextWords(model, "");
      expect(starters.length).toBe(3);
      expect(starters[0].toLowerCase()).toBe("i");
    });
  });
});
