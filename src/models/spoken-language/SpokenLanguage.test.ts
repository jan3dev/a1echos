import { i18n } from "@/localization";

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

  describe("search", () => {
    const languages = SupportedLanguages.forCodes([
      "en",
      "mk",
      "ms",
      "ro",
      "ht",
      "zh",
    ]);

    it("returns the full list for a blank query", () => {
      expect(SupportedLanguages.search(languages, "  ")).toBe(languages);
    });

    it("matches the start of any word, case-insensitively", () => {
      const codes = (query: string) =>
        SupportedLanguages.search(languages, query).map((l) => l.code);
      expect(codes(" MA")).toEqual(["ms", "mk"]);
      expect(codes("creole")).toEqual(["ht"]);
      expect(codes("简体")).toEqual(["zh"]);
      expect(codes("chinese (简体)")).toEqual(["zh"]);
      expect(codes("haitian   creole")).toEqual(["ht"]);
    });

    it("returns an empty list when nothing matches", () => {
      expect(SupportedLanguages.search(languages, "Klingon")).toEqual([]);
    });

    it("names languages in the app language and matches it or English", async () => {
      await i18n.changeLanguage("fr");
      try {
        const french = SupportedLanguages.forCodes(["de", "en"]);
        expect(french.map((l) => l.name)).toEqual(["Anglais", "Allemand"]);
        const codes = (query: string) =>
          SupportedLanguages.search(french, query).map((l) => l.code);
        expect(codes("allem")).toEqual(["de"]);
        expect(codes("german")).toEqual(["de"]);
      } finally {
        await i18n.changeLanguage("en");
      }
    });

    it("ignores Latin accents", async () => {
      await i18n.changeLanguage("es");
      try {
        const spanish = SupportedLanguages.forCodes(["ar", "es"]);
        const codes = (query: string) =>
          SupportedLanguages.search(spanish, query).map((l) => l.code);
        expect(codes("arabe")).toEqual(["ar"]);
        expect(codes("ESPANOL")).toEqual(["es"]);
        expect(codes("Español")).toEqual(["es"]);
      } finally {
        await i18n.changeLanguage("en");
      }
    });

    it("returns the same objects per app language, so rows can memoize", () => {
      expect(SupportedLanguages.forCodes(["en"])[0]).toBe(
        SupportedLanguages.findByCode("en"),
      );
    });
  });

  describe("pickerOrder", () => {
    it("puts the language first, then A to Z, without mutating the input", () => {
      const languages = [
        { code: "fr", name: "French" },
        { code: "en", name: "English" },
        { code: "de", name: "German" },
        { code: "ar", name: "Arabic" },
      ];
      expect(
        SupportedLanguages.pickerOrder(languages, "fr").map((l) => l.code),
      ).toEqual(["fr", "ar", "en", "de"]);
      expect(languages.map((l) => l.code)).toEqual(["fr", "en", "de", "ar"]);
    });

    it("sorts by the names in the current app language", async () => {
      const codes = ["ar", "de", "en"].map((code) =>
        SupportedLanguages.findByCode(code)!,
      );
      try {
        await i18n.changeLanguage("es");
        // Árabe, Alemán, Inglés collate as Alemán, Árabe, Inglés.
        expect(
          SupportedLanguages.pickerOrder(codes, "en").map((l) => l.code),
        ).toEqual(["en", "de", "ar"]);
        expect(
          SupportedLanguages.pickerOrder(codes, "xx").map((l) => l.code),
        ).toEqual(["de", "ar", "en"]);
      } finally {
        await i18n.changeLanguage("en");
      }
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
