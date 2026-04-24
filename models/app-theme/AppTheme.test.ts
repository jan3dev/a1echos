import { AppTheme, getThemeName, getThemeByName } from "./AppTheme";

describe("AppTheme", () => {
  describe("enum values", () => {
    it("has exactly 3 values", () => {
      const values = Object.values(AppTheme);
      expect(values).toHaveLength(3);
    });

    it('has AUTO = "auto"', () => {
      expect(AppTheme.AUTO).toBe("auto");
    });

    it('has LIGHT = "light"', () => {
      expect(AppTheme.LIGHT).toBe("light");
    });

    it('has DARK = "dark"', () => {
      expect(AppTheme.DARK).toBe("dark");
    });
  });

  describe("getThemeName", () => {
    it.each([
      [AppTheme.AUTO, "auto"],
      [AppTheme.LIGHT, "light"],
      [AppTheme.DARK, "dark"],
    ])('returns "%s" for AppTheme.%s', (theme, expected) => {
      expect(getThemeName(theme)).toBe(expected);
    });

    it('returns "light" for unknown value', () => {
      expect(getThemeName("unknown" as AppTheme)).toBe("light");
    });
  });

  describe("getThemeByName", () => {
    it.each([
      ["auto", AppTheme.AUTO],
      ["light", AppTheme.LIGHT],
      ["dark", AppTheme.DARK],
    ])('returns correct enum for "%s"', (name, expected) => {
      expect(getThemeByName(name)).toBe(expected);
    });

    it("returns AppTheme.LIGHT for unknown string", () => {
      expect(getThemeByName("unknown")).toBe(AppTheme.LIGHT);
    });
  });

  describe("round-trip", () => {
    it.each([AppTheme.AUTO, AppTheme.LIGHT, AppTheme.DARK])(
      "getThemeByName(getThemeName(%s)) === %s",
      (theme) => {
        expect(getThemeByName(getThemeName(theme))).toBe(theme);
      },
    );
  });
});
