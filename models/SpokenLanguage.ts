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
  name: string;
  whisperLanguage?: string;
  prompt?: string;
}

const languageData: Record<string, LanguageInfo> = {
  en: { countryCode: "united_states", name: "English" },
  zh: {
    countryCode: "china",
    name: "Chinese (简体)",
    prompt: "以下是普通话的句子。",
  },
  "zh-hant": {
    countryCode: "taiwan",
    name: "Chinese (繁體)",
    whisperLanguage: "zh",
    prompt: "以下是普通話的句子。",
  },
  de: { countryCode: "germany", name: "German" },
  es: { countryCode: "spain", name: "Spanish" },
  ru: { countryCode: "russia", name: "Russian" },
  ko: { countryCode: "south_korea", name: "Korean" },
  fr: { countryCode: "france", name: "French" },
  ja: { countryCode: "japan", name: "Japanese" },
  pt: { countryCode: "portugal", name: "Portuguese" },
  tr: { countryCode: "turkey", name: "Turkish" },
  pl: { countryCode: "poland", name: "Polish" },
  ca: { countryCode: "spain", name: "Catalan" },
  nl: { countryCode: "netherlands", name: "Dutch" },
  ar: { countryCode: "saudi_arabia", name: "Arabic" },
  sv: { countryCode: "sweden", name: "Swedish" },
  it: { countryCode: "italy", name: "Italian" },
  id: { countryCode: "indonesia", name: "Indonesian" },
  hi: { countryCode: "india", name: "Hindi" },
  fi: { countryCode: "finland", name: "Finnish" },
  vi: { countryCode: "vietnam", name: "Vietnamese" },
  he: { countryCode: "israel", name: "Hebrew" },
  uk: { countryCode: "ukraine", name: "Ukrainian" },
  el: { countryCode: "greece", name: "Greek" },
  ms: { countryCode: "malaysia", name: "Malay" },
  cs: { countryCode: "czech_republic", name: "Czech" },
  ro: { countryCode: "romania", name: "Romanian" },
  da: { countryCode: "denmark", name: "Danish" },
  hu: { countryCode: "hungary", name: "Hungarian" },
  ta: { countryCode: "india", name: "Tamil" },
  no: { countryCode: "norway", name: "Norwegian" },
  th: { countryCode: "thailand", name: "Thai" },
  ur: { countryCode: "pakistan", name: "Urdu" },
  hr: { countryCode: "croatia", name: "Croatian" },
  bg: { countryCode: "bulgaria", name: "Bulgarian" },
  lt: { countryCode: "lithuania", name: "Lithuanian" },
  la: { countryCode: "vatican_city", name: "Latin" },
  mi: { countryCode: "new_zealand", name: "Maori" },
  ml: { countryCode: "india", name: "Malayalam" },
  cy: { countryCode: "wales", name: "Welsh" },
  sk: { countryCode: "slovakia", name: "Slovak" },
  te: { countryCode: "india", name: "Telugu" },
  fa: { countryCode: "iran", name: "Persian" },
  lv: { countryCode: "latvia", name: "Latvian" },
  bn: { countryCode: "bangladesh", name: "Bengali" },
  sr: { countryCode: "serbia", name: "Serbian" },
  az: { countryCode: "azerbaijan", name: "Azerbaijani" },
  sl: { countryCode: "slovenia", name: "Slovenian" },
  kn: { countryCode: "india", name: "Kannada" },
  et: { countryCode: "estonia", name: "Estonian" },
  mk: { countryCode: "north_macedonia", name: "Macedonian" },
  br: { countryCode: "france", name: "Breton" },
  eu: { countryCode: "spain", name: "Basque" },
  is: { countryCode: "iceland", name: "Icelandic" },
  hy: { countryCode: "armenia", name: "Armenian" },
  ne: { countryCode: "nepal", name: "Nepali" },
  mn: { countryCode: "mongolia", name: "Mongolian" },
  bs: { countryCode: "bosnia_and_herzegovina", name: "Bosnian" },
  kk: { countryCode: "kazakhstan", name: "Kazakh" },
  sq: { countryCode: "albania", name: "Albanian" },
  sw: { countryCode: "tanzania", name: "Swahili" },
  gl: { countryCode: "spain", name: "Galician" },
  mr: { countryCode: "india", name: "Marathi" },
  pa: { countryCode: "india", name: "Punjabi" },
  si: { countryCode: "sri_lanka", name: "Sinhala" },
  km: { countryCode: "cambodia", name: "Khmer" },
  sn: { countryCode: "zimbabwe", name: "Shona" },
  yo: { countryCode: "nigeria", name: "Yoruba" },
  so: { countryCode: "somalia", name: "Somali" },
  af: { countryCode: "south_africa", name: "Afrikaans" },
  oc: { countryCode: "france", name: "Occitan" },
  ka: { countryCode: "georgia", name: "Georgian" },
  be: { countryCode: "belarus", name: "Belarusian" },
  tg: { countryCode: "tajikistan", name: "Tajik" },
  sd: { countryCode: "pakistan", name: "Sindhi" },
  gu: { countryCode: "india", name: "Gujarati" },
  am: { countryCode: "ethiopia", name: "Amharic" },
  yi: { countryCode: "israel", name: "Yiddish" },
  lo: { countryCode: "laos", name: "Lao" },
  uz: { countryCode: "uzbekistan", name: "Uzbek" },
  fo: { countryCode: "denmark", name: "Faroese" },
  ht: { countryCode: "haiti", name: "Haitian Creole" },
  ps: { countryCode: "afghanistan", name: "Pashto" },
  tk: { countryCode: "turkmenistan", name: "Turkmen" },
  nn: { countryCode: "norway", name: "Norwegian Nynorsk" },
  mt: { countryCode: "malta", name: "Maltese" },
  sa: { countryCode: "india", name: "Sanskrit" },
  lb: { countryCode: "luxembourg", name: "Luxembourgish" },
  my: { countryCode: "myanmar", name: "Burmese" },
  bo: { countryCode: "tibet", name: "Tibetan" },
  tl: { countryCode: "philippines", name: "Tagalog" },
  mg: { countryCode: "madagascar", name: "Malagasy" },
  as: { countryCode: "india", name: "Assamese" },
  tt: { countryCode: "russia", name: "Tatar" },
  haw: { countryCode: "hawaii", name: "Hawaiian" },
  ln: { countryCode: "democratic_republic_of_congo", name: "Lingala" },
  ha: { countryCode: "nigeria", name: "Hausa" },
  ba: { countryCode: "russia", name: "Bashkir" },
  jw: { countryCode: "indonesia", name: "Javanese" },
  su: { countryCode: "indonesia", name: "Sundanese" },
};

const allLanguages = Object.keys(languageData).map((code) => ({
  code,
  name: languageData[code].name,
}));

export const SupportedLanguages = {
  get all(): SpokenLanguage[] {
    return allLanguages;
  },

  get defaultLanguage(): SpokenLanguage {
    return { code: "en", name: "English" };
  },

  /** Returns languages filtered to those supported by the given language codes. */
  forCodes(codes: string[] | undefined): SpokenLanguage[] {
    if (!codes) return allLanguages;
    const codeSet = new Set(codes);
    return allLanguages.filter((lang) => codeSet.has(lang.code));
  },

  /** Checks whether a language code is in the given supported set. */
  isSupported(code: string, supportedCodes: string[] | undefined): boolean {
    if (!supportedCodes) return true;
    return supportedCodes.includes(code);
  },

  findByCode(code: string): SpokenLanguage | null {
    const normalizedCode = code.toLowerCase();
    return languageData[normalizedCode]
      ? { code: normalizedCode, name: languageData[normalizedCode].name }
      : null;
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
