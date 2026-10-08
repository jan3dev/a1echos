import * as Localization from "expo-localization";
import i18n, { use as i18nUse } from "i18next";
import { initReactI18next } from "react-i18next";

import arCommon from "../ar/common.json";
import bnCommon from "../bn/common.json";
import enCommon from "../en/common.json";
import enLanguages from "../en/languages.json";
import esCommon from "../es/common.json";
import frCommon from "../fr/common.json";
import hiCommon from "../hi/common.json";
import idCommon from "../id/common.json";
import ptCommon from "../pt/common.json";
import ruCommon from "../ru/common.json";
import urCommon from "../ur/common.json";
import zhCommon from "../zh/common.json";

const resources = {
  en: {
    common: enCommon,
    languages: enLanguages,
  },
  ar: { common: arCommon },
  bn: { common: bnCommon },
  es: { common: esCommon },
  fr: { common: frCommon },
  hi: { common: hiCommon },
  id: { common: idCommon },
  pt: { common: ptCommon },
  ru: { common: ruCommon },
  ur: { common: urCommon },
  zh: { common: zhCommon },
};

const deviceLocale = Localization.getLocales()[0]?.languageCode ?? "en";
const supportedLanguages = Object.keys(resources);
const fallbackLng = supportedLanguages.includes(deviceLocale)
  ? deviceLocale
  : "en";

i18nUse(initReactI18next).init({
  resources,
  lng: fallbackLng,
  fallbackLng: "en",
  defaultNS: "common",
  ns: ["common", "languages"],
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
  showSupportNotice: false,
});

export default i18n;
