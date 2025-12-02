export interface SpokenLanguage {
  code: string;
  name: string;
}

interface LanguageInfo {
  countryCode: string;
  name: string;
}

const languageData: Record<string, LanguageInfo> = {
  en: { countryCode: 'united_states', name: 'English' },
  zh: { countryCode: 'china', name: 'Chinese' },
  de: { countryCode: 'germany', name: 'German' },
  es: { countryCode: 'spain', name: 'Spanish' },
  ru: { countryCode: 'russia', name: 'Russian' },
  ko: { countryCode: 'south_korea', name: 'Korean' },
  fr: { countryCode: 'france', name: 'French' },
  ja: { countryCode: 'japan', name: 'Japanese' },
  pt: { countryCode: 'portugal', name: 'Portuguese' },
  tr: { countryCode: 'turkey', name: 'Turkish' },
  pl: { countryCode: 'poland', name: 'Polish' },
  nl: { countryCode: 'netherlands', name: 'Dutch' },
  ar: { countryCode: 'saudi_arabia', name: 'Arabic' },
  sv: { countryCode: 'sweden', name: 'Swedish' },
  it: { countryCode: 'italy', name: 'Italian' },
  id: { countryCode: 'indonesia', name: 'Indonesian' },
  fi: { countryCode: 'finland', name: 'Finnish' },
  vi: { countryCode: 'vietnam', name: 'Vietnamese' },
  he: { countryCode: 'israel', name: 'Hebrew' },
  uk: { countryCode: 'ukraine', name: 'Ukrainian' },
  el: { countryCode: 'greece', name: 'Greek' },
  ms: { countryCode: 'malaysia', name: 'Malay' },
  cs: { countryCode: 'czech_republic', name: 'Czech' },
  ro: { countryCode: 'romania', name: 'Romanian' },
  da: { countryCode: 'denmark', name: 'Danish' },
  hu: { countryCode: 'hungary', name: 'Hungarian' },
  no: { countryCode: 'norway', name: 'Norwegian' },
  hr: { countryCode: 'croatia', name: 'Croatian' },
  bg: { countryCode: 'bulgaria', name: 'Bulgarian' },
  lt: { countryCode: 'lithuania', name: 'Lithuanian' },
  la: { countryCode: 'vatican_city', name: 'Latin' },
  mi: { countryCode: 'new_zealand', name: 'Maori' },
  sk: { countryCode: 'slovakia', name: 'Slovak' },
  te: { countryCode: 'india', name: 'Telugu' },
  fa: { countryCode: 'iran', name: 'Persian' },
  lv: { countryCode: 'latvia', name: 'Latvian' },
  bn: { countryCode: 'bangladesh', name: 'Bengali' },
  sr: { countryCode: 'serbia', name: 'Serbian' },
  sl: { countryCode: 'slovenia', name: 'Slovenian' },
  kn: { countryCode: 'india', name: 'Kannada' },
  et: { countryCode: 'estonia', name: 'Estonian' },
  mk: { countryCode: 'north_macedonia', name: 'Macedonian' },
  eu: { countryCode: 'spain', name: 'Basque' },
  hy: { countryCode: 'armenia', name: 'Armenian' },
  mn: { countryCode: 'mongolia', name: 'Mongolian' },
  bs: { countryCode: 'bosnia_and_herzegovina', name: 'Bosnian' },
  kk: { countryCode: 'kazakhstan', name: 'Kazakh' },
  gl: { countryCode: 'spain', name: 'Galician' },
  sn: { countryCode: 'zimbabwe', name: 'Shona' },
  yo: { countryCode: 'nigeria', name: 'Yoruba' },
  so: { countryCode: 'somalia', name: 'Somali' },
  af: { countryCode: 'south_africa', name: 'Afrikaans' },
  oc: { countryCode: 'france', name: 'Occitan' },
  ka: { countryCode: 'georgia', name: 'Georgian' },
  be: { countryCode: 'belarus', name: 'Belarusian' },
  tg: { countryCode: 'tajikistan', name: 'Tajik' },
  lo: { countryCode: 'laos', name: 'Lao' },
  uz: { countryCode: 'uzbekistan', name: 'Uzbek' },
  mt: { countryCode: 'malta', name: 'Maltese' },
  sa: { countryCode: 'india', name: 'Sanskrit' },
  mg: { countryCode: 'madagascar', name: 'Malagasy' },
  as: { countryCode: 'india', name: 'Assamese' },
  tt: { countryCode: 'russia', name: 'Tatar' },
  ln: { countryCode: 'democratic_republic_of_congo', name: 'Lingala' },
  ba: { countryCode: 'russia', name: 'Bashkir' },
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
    return { code: 'en', name: 'English' };
  },

  findByCode(code: string): SpokenLanguage | null {
    const normalizedCode = code.toLowerCase();
    return languageData[normalizedCode]
      ? { code: normalizedCode, name: languageData[normalizedCode].name }
      : null;
  },

  countryCodeFor(code: string): string {
    return languageData[code]?.countryCode ?? 'united_states';
  },
};

export const getCountryCode = (language: SpokenLanguage): string => {
  return SupportedLanguages.countryCodeFor(language.code);
};
