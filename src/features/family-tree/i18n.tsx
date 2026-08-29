'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

type Lang = 'en' | 'ml';

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const translations: Record<string, { en: string; ml: string }> = {
  'app.name': { en: 'Family Tree', ml: 'കുടുംബവൃക്ഷം' },
  'app.tagline': { en: 'Build, visualize, and share your family\'s story', ml: 'നിങ്ങളുടെ കുടുംബത്തിന്റെ കഥ പടുത്തുയർത്തുക, പങ്കിടുക' },
  'auth.email': { en: 'Email', ml: 'ഇമെയിൽ' },
  'auth.password': { en: 'Password', ml: 'രഹസ്യവാക്ക്' },
  'auth.confirmPassword': { en: 'Confirm password', ml: 'രഹസ്യവാക്ക് വീണ്ടും' },
  'toolbar.addPerson': { en: 'Add Person', ml: 'വ്യക്തി ചേർക്കുക' },
  'toolbar.person': { en: 'Person', ml: 'വ്യക്തി' },
  'toolbar.event': { en: 'Event', ml: 'സംഭവം' },
  'toolbar.search': { en: 'Search', ml: 'തിരയുക' },
  'toolbar.share': { en: 'Share', ml: 'പങ്കിടുക' },
  'Recent activity': { en: 'Recent activity', ml: 'സമീപകാല പ്രവർത്തനങ്ങൾ' },
  'empty.title': { en: 'Start your family tree', ml: 'നിങ്ങളുടെ കുടുംബവൃക്ഷം ആരംഭിക്കുക' },
  'empty.desc': { en: 'Add your first family member to begin building your tree.', ml: 'നിങ്ങളുടെ വൃക്ഷം പണിയാൻ ആദ്യത്തെ കുടുംബാംഗത്തെ ചേർക്കുക.' },
  'empty.addFirst': { en: 'Add first person', ml: 'ആദ്യത്തെ വ്യക്തിയെ ചേർക്കുക' },
  'footnote': { en: 'Built with ❤ by one among us', ml: 'നമ്മിൽ ഒരാൾ സ്നേഹത്തോടെ നിർമ്മിച്ചത്' },
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en');

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === 'en' ? 'ml' : 'en'));
  }, []);

  const t = useCallback((key: string) => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[lang] ?? key;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  // Fallback if context is not available — return English keys as-is
  // instead of throwing (which crashes the entire app)
  if (!ctx) {
    return {
      lang: 'en' as Lang,
      setLang: () => {},
      toggleLang: () => {},
      t: (key: string) => key,
    };
  }
  return ctx;
}
