import { i18n } from "@/localization";

export interface SpokenLanguage {
  code: string;
  name: string;
}

export interface TranscribeOptions {
  language?: string;
  prompt?: string;
}

interface LanguageInfo {
  countryCode: string;
  whisperLanguage?: string;
  prompt?: string;
}

const languageData: Record<string, LanguageInfo> = {
  en: { countryCode: "united_states" },
  zh: {
    countryCode: "china",
    prompt: "以下是普通话的句子。",
  },
  "zh-hant": {
    countryCode: "taiwan",
    whisperLanguage: "zh",
    prompt: "以下是普通話的句子。",
  },
  de: { countryCode: "germany" },
  es: { countryCode: "spain" },
  ru: { countryCode: "russia" },
  ko: { countryCode: "south_korea" },
  fr: { countryCode: "france" },
  ja: { countryCode: "japan" },
  pt: { countryCode: "portugal" },
  tr: { countryCode: "turkey" },
  pl: { countryCode: "poland" },
  ca: { countryCode: "spain" },
  nl: { countryCode: "netherlands" },
  ar: { countryCode: "saudi_arabia" },
  sv: { countryCode: "sweden" },
  it: { countryCode: "italy" },
  id: { countryCode: "indonesia" },
  hi: { countryCode: "india" },
  fi: { countryCode: "finland" },
  vi: { countryCode: "vietnam" },
  he: { countryCode: "israel" },
  uk: { countryCode: "ukraine" },
  el: { countryCode: "greece" },
  ms: { countryCode: "malaysia" },
  cs: { countryCode: "czech_republic" },
  ro: { countryCode: "romania" },
  da: { countryCode: "denmark" },
  hu: { countryCode: "hungary" },
  ta: { countryCode: "india" },
  no: { countryCode: "norway" },
  th: { countryCode: "thailand" },
  ur: { countryCode: "pakistan" },
  hr: { countryCode: "croatia" },
  bg: { countryCode: "bulgaria" },
  lt: { countryCode: "lithuania" },
  la: { countryCode: "vatican_city" },
  mi: { countryCode: "new_zealand" },
  ml: { countryCode: "india" },
  cy: { countryCode: "wales" },
  sk: { countryCode: "slovakia" },
  te: { countryCode: "india" },
  fa: { countryCode: "iran" },
  lv: { countryCode: "latvia" },
  bn: { countryCode: "bangladesh" },
  sr: { countryCode: "serbia" },
  az: { countryCode: "azerbaijan" },
  sl: { countryCode: "slovenia" },
  kn: { countryCode: "india" },
  et: { countryCode: "estonia" },
  mk: { countryCode: "north_macedonia" },
  br: { countryCode: "france" },
  eu: { countryCode: "spain" },
  is: { countryCode: "iceland" },
  hy: { countryCode: "armenia" },
  ne: { countryCode: "nepal" },
  mn: { countryCode: "mongolia" },
  bs: { countryCode: "bosnia_and_herzegovina" },
  kk: { countryCode: "kazakhstan" },
  sq: { countryCode: "albania" },
  sw: { countryCode: "tanzania" },
  gl: { countryCode: "spain" },
  mr: { countryCode: "india" },
  pa: { countryCode: "india" },
  si: { countryCode: "sri_lanka" },
  km: { countryCode: "cambodia" },
  sn: { countryCode: "zimbabwe" },
  yo: { countryCode: "nigeria" },
  so: { countryCode: "somalia" },
  af: { countryCode: "south_africa" },
  oc: { countryCode: "france" },
  ka: { countryCode: "georgia" },
  be: { countryCode: "belarus" },
  tg: { countryCode: "tajikistan" },
  sd: { countryCode: "pakistan" },
  gu: { countryCode: "india" },
  am: { countryCode: "ethiopia" },
  yi: { countryCode: "israel" },
  lo: { countryCode: "laos" },
  uz: { countryCode: "uzbekistan" },
  fo: { countryCode: "denmark" },
  ht: { countryCode: "haiti" },
  ps: { countryCode: "afghanistan" },
  tk: { countryCode: "turkmenistan" },
  nn: { countryCode: "norway" },
  mt: { countryCode: "malta" },
  sa: { countryCode: "india" },
  lb: { countryCode: "luxembourg" },
  my: { countryCode: "myanmar" },
  bo: { countryCode: "tibet" },
  tl: { countryCode: "philippines" },
  mg: { countryCode: "madagascar" },
  as: { countryCode: "india" },
  tt: { countryCode: "russia" },
  haw: { countryCode: "hawaii" },
  ln: { countryCode: "democratic_republic_of_congo" },
  ha: { countryCode: "nigeria" },
  ba: { countryCode: "russia" },
  jw: { countryCode: "indonesia" },
  su: { countryCode: "indonesia" },
};

// Locale-independent lowercasing: a Turkish locale would turn "I" into "ı".
const searchWords = (text: string) =>
  ` ${text
    .toLowerCase()
    .replace(/[()\s]+/g, " ")
    .trim()}`;

const allCodes = Object.keys(languageData);

// Names come from the app language at call time; settings store the code only.
const toLanguage = (code: string): SpokenLanguage => ({
  code,
  name: i18n.t(code, { ns: "languages" }),
});

const englishName = (code: string) =>
  i18n.t(code, { ns: "languages", lng: "en" });

export const SupportedLanguages = {
  get all(): SpokenLanguage[] {
    return allCodes.map(toLanguage);
  },

  get defaultLanguage(): SpokenLanguage {
    return toLanguage("en");
  },

  /** Returns languages filtered to those supported by the given language codes. */
  forCodes(codes: string[] | undefined): SpokenLanguage[] {
    if (!codes) return SupportedLanguages.all;
    const codeSet = new Set(codes);
    return allCodes.filter((code) => codeSet.has(code)).map(toLanguage);
  },

  /** Case-insensitive match on the start of any word in the language name,
   *  in the app language or in English. */
  search(languages: SpokenLanguage[], query: string): SpokenLanguage[] {
    const needle = searchWords(query);
    if (needle === " ") return languages;
    return languages.filter(
      (lang) =>
        searchWords(lang.name).includes(needle) ||
        searchWords(englishName(lang.code)).includes(needle),
    );
  },

  /** Returns a copy with the given language moved to the front. */
  pinFirst(languages: SpokenLanguage[], code: string): SpokenLanguage[] {
    return [...languages].sort(
      (a, b) => Number(b.code === code) - Number(a.code === code),
    );
  },

  /** Checks whether a language code is in the given supported set. */
  isSupported(code: string, supportedCodes: string[] | undefined): boolean {
    if (!supportedCodes) return true;
    return supportedCodes.includes(code);
  },

  findByCode(code: string): SpokenLanguage | null {
    const normalizedCode = code.toLowerCase();
    return languageData[normalizedCode] ? toLanguage(normalizedCode) : null;
  },

  countryCodeFor(code: string): string {
    return languageData[code]?.countryCode ?? "united_states";
  },

  transcribeOptionsFor(code: string): TranscribeOptions {
    const info = languageData[code];
    if (!info) {
      return { language: code };
    }
    return {
      language: info.whisperLanguage ?? code,
      prompt: info.prompt,
    };
  },
};

export const getCountryCode = (language: SpokenLanguage): string => {
  return SupportedLanguages.countryCodeFor(language.code);
};
