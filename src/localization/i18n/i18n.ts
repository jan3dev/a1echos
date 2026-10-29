import * as Localization from "expo-localization";
import i18n, { dir as languageDirection, use as i18nUse } from "i18next";
import { I18nManager } from "react-native";
import { initReactI18next } from "react-i18next";

import arCommon from "../ar/common.json";
import arLanguages from "../ar/languages.json";
import bnCommon from "../bn/common.json";
import bnLanguages from "../bn/languages.json";
import enCommon from "../en/common.json";
import enLanguages from "../en/languages.json";
import esCommon from "../es/common.json";
import esLanguages from "../es/languages.json";
import frCommon from "../fr/common.json";
import frLanguages from "../fr/languages.json";
import hiCommon from "../hi/common.json";
import hiLanguages from "../hi/languages.json";
import idCommon from "../id/common.json";
import idLanguages from "../id/languages.json";
import ptCommon from "../pt/common.json";
import ptLanguages from "../pt/languages.json";
import ruCommon from "../ru/common.json";
import ruLanguages from "../ru/languages.json";
import urCommon from "../ur/common.json";
import urLanguages from "../ur/languages.json";
import zhCommon from "../zh/common.json";
import zhLanguages from "../zh/languages.json";

const resources = {
  en: {
    common: enCommon,
    languages: enLanguages,
  },
  ar: { common: arCommon, languages: arLanguages },
  bn: { common: bnCommon, languages: bnLanguages },
  es: { common: esCommon, languages: esLanguages },
  fr: { common: frCommon, languages: frLanguages },
  hi: { common: hiCommon, languages: hiLanguages },
  id: { common: idCommon, languages: idLanguages },
  pt: { common: ptCommon, languages: ptLanguages },
  ru: { common: ruCommon, languages: ruLanguages },
  ur: { common: urCommon, languages: urLanguages },
  zh: { common: zhCommon, languages: zhLanguages },
};

export const resolveAppLanguage = (languageCode?: string | null) =>
  languageCode && Object.hasOwn(resources, languageCode) ? languageCode : "en";

i18nUse(initReactI18next).init({
  resources,
  lng: resolveAppLanguage(Localization.getLocales()[0]?.languageCode),
  fallbackLng: "en",
  defaultNS: "common",
  ns: ["common", "languages"],
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

// React Native fixes the layout direction at launch from the device locale,
// which can disagree with the app language: unsupported RTL locales (Hebrew,
// Persian) fall back to English, and Android 13+ switches the per-app language
// without restarting. Forcing both flags makes the next launch match exactly.
// Returns true when the app must reload to apply the new direction.
export const syncLayoutDirection = (lng: string) => {
  const rtl = languageDirection(lng) === "rtl";
  if (I18nManager.isRTL === rtl) return false;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  return true;
};

export default i18n;
