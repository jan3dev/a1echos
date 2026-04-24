import { SupportedLanguages, getCountryCode } from "./SpokenLanguage";

describe("SpokenLanguage", () => {
  describe("SupportedLanguages.all", () => {
    it("returns array with 100 entries", () => {
      expect(SupportedLanguages.all).toHaveLength(100);
    });

    it("entries have code and name properties", () => {
      for (const lang of SupportedLanguages.all) {
        expect(lang).toHaveProperty("code");
        expect(lang).toHaveProperty("name");
        expect(typeof lang.code).toBe("string");
        expect(typeof lang.name).toBe("string");
      }
    });
  });

  describe("SupportedLanguages.defaultLanguage", () => {
    it("returns English", () => {
      expect(SupportedLanguages.defaultLanguage).toEqual({
        code: "en",
        name: "English",
      });
    });
  });

  describe("findByCode", () => {
    it('finds English by "en"', () => {
      expect(SupportedLanguages.findByCode("en")).toEqual({
        code: "en",
        name: "English",
      });
    });

    it("is case-insensitive", () => {
      expect(SupportedLanguages.findByCode("EN")).toEqual({
        code: "en",
        name: "English",
      });
    });

    it("returns null for unknown code", () => {
      expect(SupportedLanguages.findByCode("xx")).toBeNull();
    });
  });

  describe("countryCodeFor", () => {
    it('returns "united_states" for "en"', () => {
      expect(SupportedLanguages.countryCodeFor("en")).toBe("united_states");
    });

    it('returns "japan" for "ja"', () => {
      expect(SupportedLanguages.countryCodeFor("ja")).toBe("japan");
    });

    it('returns "united_states" for unknown code', () => {
      expect(SupportedLanguages.countryCodeFor("unknown")).toBe(
        "united_states",
      );
    });
  });

  describe("transcribeOptionsFor", () => {
    it('returns { language: "en" } for English (no prompt)', () => {
      const options = SupportedLanguages.transcribeOptionsFor("en");
      expect(options).toEqual({ language: "en" });
      expect(options.prompt).toBeUndefined();
    });

    it("returns whisperLanguage mapping and prompt for zh-hant", () => {
      const options = SupportedLanguages.transcribeOptionsFor("zh-hant");
      expect(options.language).toBe("zh");
      expect(options.prompt).toBe("以下是普通話的句子。");
    });

    it("returns { language: code } for unknown code", () => {
      expect(SupportedLanguages.transcribeOptionsFor("unknown")).toEqual({
        language: "unknown",
      });
    });
  });

  describe("forCodes", () => {
    it("returns all languages when codes is undefined", () => {
      expect(SupportedLanguages.forCodes(undefined)).toHaveLength(100);
    });

    it("filters to the matching subset", () => {
      const result = SupportedLanguages.forCodes(["en", "ja", "zz"]);
      expect(result.map((l) => l.code).sort()).toEqual(["en", "ja"]);
    });
  });

  describe("isSupported", () => {
    it("returns true when supportedCodes is undefined", () => {
      expect(SupportedLanguages.isSupported("en", undefined)).toBe(true);
    });

    it("returns true when code is in the list", () => {
      expect(SupportedLanguages.isSupported("en", ["en", "es"])).toBe(true);
    });

    it("returns false when code is not in the list", () => {
      expect(SupportedLanguages.isSupported("ja", ["en", "es"])).toBe(false);
    });
  });

  describe("getCountryCode", () => {
    it("delegates to countryCodeFor", () => {
      expect(getCountryCode({ code: "en", name: "English" })).toBe(
        "united_states",
      );
      expect(getCountryCode({ code: "ja", name: "Japanese" })).toBe("japan");
    });
  });
});
