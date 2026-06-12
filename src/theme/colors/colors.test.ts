import { AquaPrimitiveColors } from "./colors";

describe("AquaPrimitiveColors", () => {
  const keys = Object.keys(AquaPrimitiveColors);
  const values = Object.values(AquaPrimitiveColors);

  it("exports an object with 46 keys", () => {
    expect(keys).toHaveLength(46);
  });

  it("contains all expected key groups", () => {
    const grayscaleKeys = [
      "white",
      "black",
      "metal50",
      "metal100",
      "metal200",
      "metal300",
      "metal400",
      "metal500",
      "metal750",
      "metal850",
      "metal900",
      "metal950",
      "metal1000",
    ];
    const neonBlueKeys = [
      "neonBlue300",
      "neonBlue400",
      "neonBlue500",
      "neonBlue800",
      "neonBlue",
      "neonBlue16",
      "neonBlue8",
      "neonBlue400Transparent8",
    ];
    const semanticKeys = [
      "forestGreen500",
      "forestGreen",
      "forestGreen24",
      "harvestGold500",
      "harvestGold",
      "harvestGold16",
      "scarlet500",
      "scarlet",
      "scarlet16",
    ];
    const glassKeys = [
      "glassSurfaceLight",
      "glassInverseLight",
      "glassBackgroundLight",
      "glassSurfaceSecondaryLight",
      "glassSurfaceBorderLight",
      "glassSurfaceDark",
      "glassInverseDark",
      "glassBackgroundDark",
      "glassSurfaceSecondaryDark",
      "glassSurfaceBorderDark",
    ];
    const rippleKeys = ["rippleLight", "rippleDark", "rippleOnPrimary"];
    const waveKeys = ["waveOrange", "waveCyan"];
    const systemKeys = ["systemBackgroundColor"];

    const allExpectedKeys = [
      ...grayscaleKeys,
      ...neonBlueKeys,
      ...semanticKeys,
      ...glassKeys,
      ...rippleKeys,
      ...waveKeys,
      ...systemKeys,
    ];

    for (const key of allExpectedKeys) {
      expect(AquaPrimitiveColors).toHaveProperty(key);
    }
  });

  it("has all string values", () => {
    for (const value of values) {
      expect(typeof value).toBe("string");
    }
  });

  it("hex values match #RRGGBB pattern", () => {
    const hexValues = values.filter((v) => v.startsWith("#"));
    expect(hexValues.length).toBeGreaterThan(0);
    for (const hex of hexValues) {
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("rgba values match rgba(...) pattern", () => {
    const rgbaValues = values.filter((v) => v.startsWith("rgba"));
    expect(rgbaValues.length).toBeGreaterThan(0);
    for (const rgba of rgbaValues) {
      expect(rgba).toMatch(/^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/);
    }
  });

  it.each([
    ["white", "#FFFFFF"],
    ["black", "#000000"],
    ["neonBlue", "#4361EE"],
    ["forestGreen", "#18A23B"],
    ["harvestGold", "#FFAB1B"],
    ["scarlet", "#FF3B13"],
  ] as const)("%s === %s", (key, expected) => {
    expect(AquaPrimitiveColors[key]).toBe(expected);
  });
});
