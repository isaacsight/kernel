import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import HttpBackend from 'i18next-http-backend'
import LanguageDetector from 'i18next-browser-languagedetector'

const RTL_LANGUAGES = ['ar']

const SUPPORTED = ['en','es','fr','de','pt','it','nl','ru','zh','zh-TW','ja','ko','ar','hi','tr','pl','sv','no','da','fi']

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: SUPPORTED,
    load: 'currentOnly',
    ns: ['common', 'home', 'auth', 'onboarding', 'panels', 'kernel'],
    defaultNS: 'common',
    backend: {
      loadPath: `${import.meta.env.BASE_URL}locales/{{lng}}/{{ns}}.json`,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'kernel-language',
      caches: ['localStorage'],
      convertDetectedLanguage: (lng: string) => {
        if (SUPPORTED.includes(lng)) return lng
        const base = lng.split('-')[0]
        return SUPPORTED.includes(base) ? base : lng
      },
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  })

// Update document direction and lang on language change
i18n.on('languageChanged', (lng) => {
  const dir = RTL_LANGUAGES.includes(lng) ? 'rtl' : 'ltr'
  document.documentElement.dir = dir
  document.documentElement.lang = lng
})

export default i18n
