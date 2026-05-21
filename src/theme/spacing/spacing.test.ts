import { spacing } from "./spacing";

describe("spacing", () => {
  const keys = Object.keys(spacing);
  const values = Object.values(spacing);

  it("has exactly 9 keys", () => {
    expect(keys).toHaveLength(9);
    expect(keys).toEqual([
      "xs",
      "sm",
      "md",
      "lg",
      "xl",
      "xxl",
      "xxxl",
      "unit7",
      "unit8",
    ]);
  });

  it("all values are positive numbers", () => {
    for (const value of values) {
      expect(typeof value).toBe("number");
      expect(value).toBeGreaterThan(0);
    }
  });

  it("values increase monotonically", () => {
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it.each([
    ["xs", 4],
    ["sm", 8],
    ["md", 16],
    ["lg", 24],
    ["xl", 32],
    ["xxl", 40],
    ["xxxl", 48],
    ["unit7", 56],
    ["unit8", 64],
  ] as const)("%s === %d", (key, expected) => {
    expect(spacing[key]).toBe(expected);
  });
});
