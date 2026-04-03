import { createContext, useContext, useState, useCallback } from 'react'
import en from '../locales/en.json'

const locales = { en }

const I18nContext = createContext()

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState('en')

  const t = useCallback((key) => {
    const keys = key.split('.')
    let value = locales[locale]
    for (const k of keys) {
      if (value == null) return key
      value = value[k]
    }
    return value ?? key
  }, [locale])

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used within I18nProvider')
  return context
}
