import { darkColors, lightColors } from "./themeColors";

describe("themeColors", () => {
  const lightKeys = Object.keys(lightColors);
  const darkKeys = Object.keys(darkColors);

  it("lightColors and darkColors each have 31 properties", () => {
    expect(lightKeys).toHaveLength(31);
    expect(darkKeys).toHaveLength(31);
  });

  it("all values are strings", () => {
    for (const value of Object.values(lightColors)) {
      expect(typeof value).toBe("string");
    }
    for (const value of Object.values(darkColors)) {
      expect(typeof value).toBe("string");
    }
  });

  it("lightColors and darkColors have identical key sets", () => {
    expect([...lightKeys].sort()).toEqual([...darkKeys].sort());
  });

  it("contains all semantic groups", () => {
    const groups = {
      text: ["textPrimary", "textSecondary", "textTertiary", "textInverse"],
      surface: [
        "surfacePrimary",
        "surfaceSecondary",
        "surfaceTertiary",
        "surfaceInverse",
        "surfaceBackground",
        "surfaceSelected",
      ],
      glass: ["glassSurface", "glassInverse", "glassBackground"],
      accent: [
        "accentBrand",
        "accentBrandTransparent",
        "accentSuccess",
        "accentDanger",
      ],
      chip: [
        "chipSuccessBackgroundColor",
        "chipErrorBackgroundColor",
        "chipSuccessForegroundColor",
        "chipErrorForegroundColor",
      ],
      ripple: ["ripple", "rippleOnPrimary"],
      system: ["systemBackgroundColor"],
    };

    for (const keys of Object.values(groups)) {
      for (const key of keys) {
        expect(lightColors).toHaveProperty(key);
        expect(darkColors).toHaveProperty(key);
      }
    }
  });

  it("light and dark differ for key colors", () => {
    expect(lightColors.textPrimary).not.toBe(darkColors.textPrimary);
    expect(lightColors.surfacePrimary).not.toBe(darkColors.surfacePrimary);
    expect(lightColors.ripple).not.toBe(darkColors.ripple);
  });

  it("shared accent colors match in both themes", () => {
    expect(lightColors.accentBrand).toBe(darkColors.accentBrand);
    expect(lightColors.accentBrandTransparent).toBe(
      darkColors.accentBrandTransparent,
    );
    expect(lightColors.accentSuccess).toBe(darkColors.accentSuccess);
    expect(lightColors.accentWarning).toBe(darkColors.accentWarning);
    expect(lightColors.accentDanger).toBe(darkColors.accentDanger);
    expect(lightColors.rippleOnPrimary).toBe(darkColors.rippleOnPrimary);
  });
});
