export interface SpokenLanguage {
  code: string;
}

interface LanguageInfo {
  countryCode: string;
}

const languageData: Record<string, LanguageInfo> = {
  en: { countryCode: 'united_states' },
  zh: { countryCode: 'china' },
  de: { countryCode: 'germany' },
  es: { countryCode: 'spain' },
  ru: { countryCode: 'russia' },
  ko: { countryCode: 'south_korea' },
  fr: { countryCode: 'france' },
  ja: { countryCode: 'japan' },
  pt: { countryCode: 'portugal' },
  tr: { countryCode: 'turkey' },
  pl: { countryCode: 'poland' },
  nl: { countryCode: 'netherlands' },
  ar: { countryCode: 'saudi_arabia' },
  sv: { countryCode: 'sweden' },
  it: { countryCode: 'italy' },
  id: { countryCode: 'indonesia' },
  fi: { countryCode: 'finland' },
  vi: { countryCode: 'vietnam' },
  he: { countryCode: 'israel' },
  uk: { countryCode: 'ukraine' },
  el: { countryCode: 'greece' },
  ms: { countryCode: 'malaysia' },
  cs: { countryCode: 'czech_republic' },
  ro: { countryCode: 'romania' },
  da: { countryCode: 'denmark' },
  hu: { countryCode: 'hungary' },
  no: { countryCode: 'norway' },
  hr: { countryCode: 'croatia' },
  bg: { countryCode: 'bulgaria' },
  lt: { countryCode: 'lithuania' },
  la: { countryCode: 'vatican_city' },
  mi: { countryCode: 'new_zealand' },
  sk: { countryCode: 'slovakia' },
  te: { countryCode: 'india' },
  fa: { countryCode: 'iran' },
  lv: { countryCode: 'latvia' },
  bn: { countryCode: 'bangladesh' },
  sr: { countryCode: 'serbia' },
  sl: { countryCode: 'slovenia' },
  kn: { countryCode: 'india' },
  et: { countryCode: 'estonia' },
  mk: { countryCode: 'north_macedonia' },
  eu: { countryCode: 'spain' },
  hy: { countryCode: 'armenia' },
  mn: { countryCode: 'mongolia' },
  bs: { countryCode: 'bosnia_and_herzegovina' },
  kk: { countryCode: 'kazakhstan' },
  gl: { countryCode: 'spain' },
  sn: { countryCode: 'zimbabwe' },
  yo: { countryCode: 'nigeria' },
  so: { countryCode: 'somalia' },
  af: { countryCode: 'south_africa' },
  oc: { countryCode: 'france' },
  ka: { countryCode: 'georgia' },
  be: { countryCode: 'belarus' },
  tg: { countryCode: 'tajikistan' },
  lo: { countryCode: 'laos' },
  uz: { countryCode: 'uzbekistan' },
  mt: { countryCode: 'malta' },
  sa: { countryCode: 'india' },
  mg: { countryCode: 'madagascar' },
  as: { countryCode: 'india' },
  tt: { countryCode: 'russia' },
  ln: { countryCode: 'democratic_republic_of_congo' },
  ba: { countryCode: 'russia' },
};

const allLanguages = Object.keys(languageData).map((code) => ({ code }));

export const SupportedLanguages = {
  get all(): SpokenLanguage[] {
    return allLanguages;
  },

  get defaultLanguage(): SpokenLanguage {
    return { code: 'en' };
  },

  findByCode(code: string): SpokenLanguage | null {
    const normalizedCode = code.toLowerCase();
    return languageData[normalizedCode] ? { code: normalizedCode } : null;
  },

  countryCodeFor(code: string): string {
    return languageData[code]?.countryCode ?? 'united_states';
  },
};

export const getCountryCode = (language: SpokenLanguage): string => {
  return SupportedLanguages.countryCodeFor(language.code);
};
