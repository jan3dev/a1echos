import * as Localization from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from './en/common.json';
import enLanguages from './en/languages.json';

const resources = {
  en: {
    common: enCommon,
    languages: enLanguages,
  },
};

const deviceLocale = Localization.getLocales()[0]?.languageCode ?? 'en';
const supportedLanguages = Object.keys(resources);
const fallbackLng = supportedLanguages.includes(deviceLocale)
  ? deviceLocale
  : 'en';

i18next.use(initReactI18next).init({
  resources,
  lng: fallbackLng,
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'languages'],
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18next;
