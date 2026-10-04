import { LANGUAGES, type Language } from '@landrush/shared';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en';
import lv from './lv';
import ru from './ru';

export const LANGUAGE_NAMES: Record<Language, string> = {
  lv: 'Latviešu',
  ru: 'Русский',
  en: 'English',
};

function deviceLanguage(): Language {
  for (const locale of getLocales()) {
    const code = locale.languageCode as Language | null;
    if (code && LANGUAGES.includes(code)) return code;
  }
  return 'lv';
}

// eslint-disable-next-line import/no-named-as-default-member -- i18next's documented setup
i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, lv: { translation: lv }, ru: { translation: ru } },
  lng: deviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
