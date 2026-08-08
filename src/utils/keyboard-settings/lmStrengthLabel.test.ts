import {
  lmStrengthExampleKey,
  lmStrengthLabelKey,
} from "./lmStrengthLabel";

describe("lmStrengthLabelKey", () => {
  it("maps each selectable strength to its own label key", () => {
    expect(lmStrengthLabelKey(0.5)).toBe("lmStrengthSubtle");
    expect(lmStrengthLabelKey(1.0)).toBe("lmStrengthBalanced");
    expect(lmStrengthLabelKey(1.5)).toBe("lmStrengthStrong");
    expect(lmStrengthLabelKey(2.0)).toBe("lmStrengthMax");
  });

  it("maps distinct strengths to distinct keys", () => {
    const keys = [0.5, 1.0, 1.5, 2.0].map(lmStrengthLabelKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("falls back to balanced for unknown values", () => {
    expect(lmStrengthLabelKey(0)).toBe("lmStrengthBalanced");
    expect(lmStrengthLabelKey(0.75)).toBe("lmStrengthBalanced");
    expect(lmStrengthLabelKey(99)).toBe("lmStrengthBalanced");
    expect(lmStrengthLabelKey(Number.NaN)).toBe("lmStrengthBalanced");
  });
});

describe("lmStrengthExampleKey", () => {
  it("maps each selectable strength to its own example key", () => {
    expect(lmStrengthExampleKey(0.5)).toBe("lmStrengthSubtleExample");
    expect(lmStrengthExampleKey(1.0)).toBe("lmStrengthBalancedExample");
    expect(lmStrengthExampleKey(1.5)).toBe("lmStrengthStrongExample");
    expect(lmStrengthExampleKey(2.0)).toBe("lmStrengthMaxExample");
  });

  // Derived from the label key, so the pair can never drift apart.
  it("suffixes whatever label key the strength resolves to", () => {
    for (const strength of [0.5, 1.0, 1.5, 2.0, 99, Number.NaN]) {
      expect(lmStrengthExampleKey(strength)).toBe(
        `${lmStrengthLabelKey(strength)}Example`,
      );
    }
  });
});
