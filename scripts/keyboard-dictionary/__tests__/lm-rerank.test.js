const fs = require("node:fs");
const path = require("node:path");
const { decode, evaluate, applyLmRerank, TUNING } = require("../decoder");
const { makeStubReranker: stub } = require("../lm-stub");

/**
 * LM-reranker blend suite. The reranker is a stub returning fixed
 * length-normalized logprobs, so these vectors pin the blend math and the
 * sentence-initial confusable arbitration without needing a model. The
 * native mirrors (Swift/Kotlin) run the same vectors from
 * parity-fixtures.json's `lmRerank` section.
 */

const DICTIONARY = path.join(
  __dirname,
  "../../../data/keyboard-dictionary/keyboard_dictionary.echd",
);


describe("applyLmRerank", () => {
  const mk = (word, score) => ({ word, flags: 0, score, editCost: 0.5 });

  test("no reranker is the identity", () => {
    const scored = [mk("their", 1.0), mk("there", 0.9)];
    expect(applyLmRerank(scored, "ctx", null, TUNING.lmStrength)).toBe(scored);
  });

  test("reranker returning null leaves ranking untouched", () => {
    const scored = [mk("their", 1.0), mk("there", 0.9)];
    const out = applyLmRerank(scored, "unknown", stub({}), TUNING.lmStrength);
    expect(out.map((c) => c.word)).toEqual(["their", "there"]);
    expect(out[0].score).toBe(1.0);
  });

  test("LM evidence flips a near-tie", () => {
    // Classical scores 0.1 apart; LM strongly prefers the runner-up. With
    // softmax([-0.2, -3]) ≈ [0.94, 0.06], the blend adds ~0.94·λ vs ~0.06·λ.
    const scored = [mk("their", 1.0), mk("there", 0.9)];
    const out = applyLmRerank(
      scored,
      "I went",
      stub({ "I went": { there: -0.2, their: -3.0 } }),
      TUNING.lmStrength,
    );
    expect(out[0].word).toBe("there");
  });

  test("LM cannot resurrect a distant candidate", () => {
    // Gap of 2.0 score points exceeds the maximum λ·1.0 the LM can add.
    const scored = [mk("their", 3.0), mk("there", 1.0)];
    const out = applyLmRerank(
      scored,
      "I went",
      stub({ "I went": { there: 0.0, their: -9.0 } }),
      TUNING.lmStrength,
    );
    expect(out[0].word).toBe("their");
  });

  test("candidates beyond the top-N re-sort with unchanged scores", () => {
    const scored = [
      mk("aaaa", 1.0),
      mk("bbbb", 0.9),
      mk("cccc", 0.8),
      mk("dddd", 0.7),
      mk("eeee", 0.6),
      mk("ffff", 0.55),
    ];
    const out = applyLmRerank(
      scored,
      "x",
      // All top-5 get ~equal tiny boosts except "eeee", which gets ~λ.
      stub({ x: { aaaa: -9, bbbb: -9, cccc: -9, dddd: -9, eeee: 0 } }),
      TUNING.lmStrength,
    );
    expect(out[0].word).toBe("eeee");
    const ffff = out.find((c) => c.word === "ffff");
    expect(ffff.score).toBe(0.55);
  });
});

describe("evaluate with reranker (shipped dictionary)", () => {
  const model = decode(fs.readFileSync(DICTIONARY));

  test("LM-off evaluate is bit-identical to no-options evaluate", () => {
    const a = evaluate(model, "teh", "on");
    const b = evaluate(model, "teh", "on", {
      reranker: null,
      leftContext: "on",
    });
    expect(b).toEqual(a);
  });

  test("sentence-initial confusable contracts when LM prefers contraction", () => {
    const out = evaluate(model, "Ill", null, {
      leftContext: "",
      reranker: stub({ "": { Ill: -4.0, "I'll": -0.5 } }),
    });
    expect(out.replacement).toBe("I'll");
    expect(out.topIsCorrection).toBe(true);
  });

  test("sentence-initial confusable left alone when LM prefers the literal word", () => {
    const ctx = "The doctor examined them.";
    const out = evaluate(model, "Ill", null, {
      leftContext: ctx,
      reranker: stub({ [ctx]: { Ill: -0.5, "I'll": -4.0 } }),
    });
    expect(out.topIsCorrection).toBe(false);
    expect(out.replacement).toBe(null);
    // The contraction stays available as a tap suggestion.
    expect(out.candidates).toEqual(["I'll"]);
  });

  test("confusable arbitration falls back to contracting when LM abstains", () => {
    const out = evaluate(model, "Ill", null, {
      leftContext: "anything",
      reranker: stub({}),
    });
    expect(out.replacement).toBe("I'll");
    expect(out.topIsCorrection).toBe(true);
  });
});
