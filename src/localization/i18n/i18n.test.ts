import i18n from "./i18n";

const en = require("../en/common.json") as Record<string, string>;

const LOCALES: Record<string, Record<string, string>> = {
  ar: require("../ar/common.json"),
  bn: require("../bn/common.json"),
  es: require("../es/common.json"),
  fr: require("../fr/common.json"),
  hi: require("../hi/common.json"),
  id: require("../id/common.json"),
  pt: require("../pt/common.json"),
  ru: require("../ru/common.json"),
  ur: require("../ur/common.json"),
  zh: require("../zh/common.json"),
};

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

const placeholders = (text: string) =>
  (text.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((p) => p.replace(/\s/g, ""));

const pluralBases = new Set(
  Object.keys(en)
    .filter((key) => PLURAL_SUFFIX.test(key))
    .map((key) => key.replace(PLURAL_SUFFIX, "")),
);
const plainKeys = Object.keys(en).filter((key) => !PLURAL_SUFFIX.test(key));

describe.each(Object.entries(LOCALES))("%s translations", (lng, strings) => {
  const categories = new Intl.PluralRules(lng).resolvedOptions()
    .pluralCategories;

  it("translates every plain key with the same placeholders", () => {
    for (const key of plainKeys) {
      expect([key, typeof strings[key]]).toEqual([key, "string"]);
      expect([key, strings[key].trim().length > 0]).toEqual([key, true]);
      expect([key, placeholders(strings[key]).sort()]).toEqual([
        key,
        placeholders(en[key]).sort(),
      ]);
    }
  });

  it("has every plural form the language needs", () => {
    for (const base of pluralBases) {
      const required = new Set<string>(categories);
      if (`${base}_zero` in en) required.add("zero");
      for (const category of required) {
        expect(strings).toHaveProperty([`${base}_${category}`]);
        const key = `${base}_${category}`;
        // Arabic spells out zero, one and two; the selection prompt also
        // deliberately omits the count for zero in every language.
        const omitsCount =
          (lng === "ar" && ["zero", "one", "two"].includes(category)) ||
          (category === "zero" && `${base}_zero` in en);
        if (!omitsCount) {
          expect([key, placeholders(strings[key]).sort()]).toEqual([
            key,
            placeholders(en[`${base}_other`]).sort(),
          ]);
        }
      }
    }
  });

  it("uses no placeholders beyond the English ones", () => {
    for (const [key, value] of Object.entries(strings)) {
      const base = key.replace(PLURAL_SUFFIX, "");
      const source = pluralBases.has(base) ? en[`${base}_other`] : en[key];
      expect([key, source !== undefined]).toEqual([key, true]);
      const allowed = new Set(placeholders(source));
      for (const placeholder of placeholders(value)) {
        expect([key, allowed.has(placeholder)]).toEqual([key, true]);
      }
    }
  });

  it("registers the translations used by the app", () => {
    for (const [key, value] of Object.entries(strings)) {
      expect(i18n.getResource(lng, "common", key)).toBe(value);
    }
  });

  it.each([0, 1, 2, 3, 5, 11, 21, 100, 101, 1000000])(
    "renders plural messages for count %i without falling back to English",
    (count) => {
      const category = new Intl.PluralRules(lng).select(count);
      for (const base of pluralBases) {
        const key = count === 0 && `${base}_zero` in strings
          ? `${base}_zero`
          : `${base}_${category}`;
        expect(i18n.t(base, { lng, count })).toBe(
          strings[key].replace(/\{\{count\}\}/g, String(count)),
        );
      }
    },
  );
});

describe("i18n resources", () => {
  afterAll(() => i18n.changeLanguage("en"));

  it("resolves plural forms per language", async () => {
    await i18n.changeLanguage("ru");
    expect(i18n.t("sessionCount", { count: 1 })).toBe("1 сессия");
    expect(i18n.t("sessionCount", { count: 3 })).toBe("3 сессии");
    expect(i18n.t("sessionCount", { count: 5 })).toBe("5 сессий");

    await i18n.changeLanguage("ar");
    expect(i18n.t("sessionCount", { count: 2 })).toBe("جلستان");

    await i18n.changeLanguage("zh");
    expect(i18n.t("selectedCount", { count: 0 })).toBe("选择项目");
    expect(i18n.t("selectedCount", { count: 4 })).toBe("已选择 4 项");
  });

  it("falls back to English for keys only English has", async () => {
    await i18n.changeLanguage("fr");
    expect(i18n.t("english", { ns: "languages" })).toBe("English");
  });
});
