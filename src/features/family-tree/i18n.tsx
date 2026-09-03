'use client';

// Family Tree — English / Malayalam internationalization
// This is intentionally a small, safe i18n provider:
// - No external i18n dependency (no next-intl / react-intl cascading issues).
// - Every look-up falls back to English / the raw key, so a missing translation
//   can never crash the app.
// - The language choice is persisted in localStorage and restored on reload.
//
// To add a string: add one entry to `translations` and call `t('key')` in the
// component. Use `{name}` placeholders and pass values as `t('key', { name })`.

import { createContext, useContext, useEffect, useState, useCallback, useMemo, startTransition } from 'react';
import type { ReactNode } from 'react';

export type Lang = 'en' | 'ml';
type I18nVars = Record<string, string | number>;
type TranslationEntry = { en: string; ml: string };

const LANG_STORAGE_KEY = 'familytree.lang.v1';

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (key: string, vars?: I18nVars) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const translations: Record<string, TranslationEntry> = {
  'app.name': { en: 'Family Tree', ml: 'കുടുംബവൃക്ഷം' },
  'app.tagline': { en: 'Build, visualize, and share your family\u2019s story', ml: 'നിങ്ങളുടെ കുടുംബത്തിന്റെ കഥ പടുത്തുയർത്തുക, പങ്കിടുക' },
  'app.footer': { en: 'Built with ❤ by one among us', ml: 'നമ്മിൽ ഒരാൾ സ്നേഹത്തോടെ നിർമ്മിച്ചത്' },

  // Auth
  'auth.demoMode': { en: 'Demo mode — sign in with any email to explore', ml: 'ഡെമോ മോഡ് — പരീക്ഷിക്കാൻ ഏതെങ്കിലും ഇമെയിൽ ഉപയോഗിച്ച് സൈൻ ഇൻ ചെയ്യുക' },
  'auth.haveCode': { en: 'Have a family code?', ml: 'കുടുംബ കോഡ് ഉണ്ടോ?' },
  'auth.codeHint': { en: 'Ask your family member for the 6-character code.', ml: 'കുടുംബാംഗത്തോട് 6 അക്ഷര കോഡ് ചോദിക്കുക.' },
  'auth.enterFamilyTree': { en: '🔑 Enter Family Tree', ml: '🔑 കുടുംബവൃക്ഷത്തിലേക്ക് പ്രവേശിക്കുക' },
  'auth.joining': { en: 'Joining…', ml: 'ചേരുന്നു…' },
  'common.pleaseWait': { en: 'Please wait...', ml: 'ദയവായി കാത്തിരിക്കുക…' },
  'auth.signIn': { en: 'Sign in', ml: 'സൈൻ ഇൻ' },
  'auth.signUp': { en: 'Create account', ml: 'അക്കൗണ്ട് സൃഷ്ടിക്കുക' },
  'auth.email': { en: 'Email', ml: 'ഇമെയിൽ' },
  'auth.password': { en: 'Password', ml: 'രഹസ്യവാക്ക്' },
  'auth.confirmPassword': { en: 'Confirm password', ml: 'രഹസ്യവാക്ക് വീണ്ടും' },
  'auth.otp': { en: '6-digit code', ml: '6 അക്ക കോഡ്' },
  'auth.otpSent': { en: 'We sent a 6-digit code to {email}. Check your inbox and enter it below.', ml: '{email} എന്ന ഇമെയിലിലേക്ക് 6 അക്ക കോഡ് അയച്ചു. ഇൻബോക്സ് പരിശോധിച്ച് താഴെ നൽകുക.' },
  'auth.otpVerify': { en: 'Verify code', ml: 'കോഡ് പരിശോധിക്കുക' },
  'auth.otpSendCode': { en: 'Send code', ml: 'കോഡ് അയയ്ക്കുക' },
  'auth.showPassword': { en: 'Show password', ml: 'രഹസ്യവാക്ക് കാണിക്കുക' },
  'auth.hidePassword': { en: 'Hide password', ml: 'രഹസ്യവാക്ക് മറയ്ക്കുക' },
  'auth.switchToEmailLink': { en: '✉️ Sign in with email link (no password needed)', ml: '✉️ ഇമെയിൽ ലിങ്ക് ഉപയോഗിച്ച് സൈൻ ഇൻ ചെയ്യുക (രഹസ്യവാക്ക് ആവശ്യമില്ല)' },
  'auth.switchToPassword': { en: '← Sign in with password instead', ml: '← രഹസ്യവാക്ക് ഉപയോഗിച്ച് സൈൻ ഇൻ ചെയ്യുക' },
  'auth.differentEmail': { en: '← Use a different email', ml: '← മറ്റൊരു ഇമെയിൽ ഉപയോഗിക്കുക' },
  'auth.errorEmailRequired': { en: 'Email is required', ml: 'ഇമെയിൽ ആവശ്യമാണ്' },
  'auth.errorPasswordRequired': { en: 'Password is required', ml: 'രഹസ്യവാക്ക് ആവശ്യമാണ്' },
  'auth.errorPasswordMismatch': { en: 'Passwords do not match', ml: 'രഹസ്യവാക്കുകൾ തുല്യമല്ല' },
  'auth.errorPasswordTooShort': { en: 'Password must be at least 6 characters', ml: 'രഹസ്യവാക്ക് കുറഞ്ഞത് 6 അക്ഷരങ്ങളായിരിക്കണം' },
  'auth.errorOtpRequired': { en: 'Enter the 6-digit code from your email', ml: 'ഇമെയിലിൽ നിന്നുള്ള 6 അക്ക കോഡ് നൽകുക' },
  'auth.errorCodeRequired': { en: 'Enter your family code', ml: 'നിങ്ങളുടെ കുടുംബ കോഡ് നൽകുക' },
  'auth.errorGuestFailed': { en: 'Could not create the guest account. Please try again.', ml: 'അതിഥി അക്കൗണ്ട് സൃഷ്ടിക്കാൻ കഴിഞ്ഞില്ല. വീണ്ടും ശ്രമിക്കുക.' },
  'auth.signedInLoading': { en: 'Signed in! Loading your families…', ml: 'സൈൻ ഇൻ! കുടുംബങ്ങൾ ലോഡുചെയ്യുന്നു…' },

  // Empty state
  'empty.title': { en: 'Start your family tree', ml: 'നിങ്ങളുടെ കുടുംബവൃക്ഷം ആരംഭിക്കുക' },
  'empty.desc': { en: 'Add your first family member to begin building your tree.', ml: 'നിങ്ങളുടെ വൃക്ഷം പണിയാൻ ആദ്യത്തെ കുടുംബാംഗത്തെ ചേർക്കുക.' },
  'empty.addFirst': { en: 'Add first person', ml: 'ആദ്യത്തെ വ്യക്തിയെ ചേർക്കുക' },

  // Family tree toolbar / panels
  'toolbar.addPerson': { en: 'Add Person', ml: 'വ്യക്തി ചേർക്കുക' },
  'toolbar.person': { en: 'Person', ml: 'വ്യക്തി' },
  'toolbar.event': { en: 'Event', ml: 'സംഭവം' },
  'toolbar.search': { en: 'Search', ml: 'തിരയുക' },
  'toolbar.share': { en: 'Share', ml: 'പങ്കിടുക' },
  'toolbar.birthdays': { en: 'Birthdays', ml: 'ജന്മദിനങ്ങൾ' },
  'toolbar.map': { en: 'Birthplace map', ml: 'ജന്മസ്ഥല ഭൂപടം' },
  'toolbar.chat': { en: 'Family chat', ml: 'കുടുംബ ചാറ്റ്' },
  'toolbar.exportPng': { en: 'Export PNG', ml: 'PNG എക്സ്പോർട്ട്' },
  'toolbar.exportPdf': { en: 'Export PDF', ml: 'PDF എക്സ്പോർട്ട്' },
  'toolbar.importCsv': { en: 'Import from CSV', ml: 'CSV-ൽ നിന്ന് ഇറക്കുമതി ചെയ്യുക' },
  'toolbar.manageMembers': { en: 'Manage members', ml: 'അംഗങ്ങളെ നിയന്ത്രിക്കുക' },
  'toolbar.switchFamily': { en: 'Switch / create / join family', ml: 'കുടുംബം മാറ്റുക / സൃഷ്ടിക്കുക / ചേരുക' },
  'toolbar.linkedFamilies': { en: 'Linked families', ml: 'ബന്ധിപ്പിച്ച കുടുംബങ്ങൾ' },
  'canvas.linkedFamilies': { en: 'Linked families', ml: 'ബന്ധിപ്പിച്ച കുടുംബങ്ങൾ' },
  'canvas.viewTree': { en: 'View', ml: 'കാണുക' },
  'canvas.switchToTree': { en: 'Switch to this tree', ml: 'ഈ വൃക്ഷത്തിലേക്ക് മാറുക' },
  'canvas.linkedThrough': { en: 'Linked through {name}', ml: '{name} വഴി ബന്ധിപ്പിച്ചിരിക്കുന്നു' },
  'toolbar.signOut': { en: 'Sign out', ml: 'സൈൻ ഔട്ട്' },
  'toolbar.signOutConfirm': { en: 'Sign out of Family Tree? You can sign back in with the same email.', ml: 'കുടുംബവൃക്ഷത്തിൽ നിന്ന് സൈൻ ഔട്ട് ചെയ്യണോ? ഇതേ ഇമെയിൽ ഉപയോഗിച്ച് വീണ്ടും സൈൻ ഇൻ ചെയ്യാം.' },
  'toolbar.recentActivity': { en: 'Recent activity', ml: 'സമീപകാല പ്രവർത്തനങ്ങൾ' },
  'toolbar.undo': { en: 'Undo (Ctrl/Cmd+Z)', ml: 'പഴയതിലേക്ക് (Ctrl/Cmd+Z)' },
  'toolbar.redo': { en: 'Redo (Ctrl/Cmd+Shift+Z)', ml: 'വീണ്ടും ചെയ്യുക (Ctrl/Cmd+Shift+Z)' },
  'toolbar.install': { en: 'Install app', ml: 'ആപ്പ് ഇൻസ്റ്റാൾ ചെയ്യുക' },

  // Family selection
  'family.yourFamilies': { en: 'Your families', ml: 'നിങ്ങളുടെ കുടുംബങ്ങൾ' },
  'family.signedInAs': { en: 'Signed in as {email}', ml: '{email} ആയി സൈൻ ഇൻ ചെയ്തിരിക്കുന്നു' },
  'family.member': { en: 'member', ml: 'അംഗം' },
  'family.members': { en: 'members', ml: 'അംഗങ്ങൾ' },
  'family.createNew': { en: 'Create new family', ml: 'പുതിയ കുടുംബം സൃഷ്ടിക്കുക' },
  'family.joinWithCode': { en: 'Join with code', ml: 'കോഡ് ഉപയോഗിച്ച് ചേരുക' },
  'family.currentlyActive': { en: 'Currently active', ml: 'ഇപ്പോൾ സജീവം' },
  'family.open': { en: 'Open', ml: 'തുറക്കുക' },
  'family.codeLabel': { en: 'Code', ml: 'കോഡ്' },
  'family.signOut': { en: 'Sign out', ml: 'സൈൻ ഔട്ട്' },

  // Welcome / create / join screens
  'auth.welcomeTitle': { en: 'Welcome, {email}!', ml: '{email}, സ്വാഗതം!' },
  'auth.welcomeDesc': { en: 'Create a new family tree, or join an existing one with a share code.', ml: 'പുതിയ കുടുംബവൃക്ഷം സൃഷ്ടിക്കുക, അല്ലെങ്കിൽ പങ്കിടൽ കോഡ് ഉപയോഗിച്ച് നിലവിലുള്ളതിൽ ചേരുക.' },
  'auth.createFamily': { en: 'Create a family', ml: 'ഒരു കുടുംബം സൃഷ്ടിക്കുക' },
  'auth.createFamilyDesc': { en: 'Start a new tree from scratch', ml: 'പുതിയതായി ഒരു വൃക്ഷം തുടങ്ങുക' },
  'auth.joinFamily': { en: 'Join with a code', ml: 'കോഡ് ഉപയോഗിച്ച് ചേരുക' },
  'auth.joinFamilyDesc': { en: 'Enter a share code from a family member', ml: 'കുടുംബാംഗത്തിൽ നിന്നുള്ള പങ്കിടൽ കോഡ് നൽകുക' },
  'auth.familyName': { en: 'Family name', ml: 'കുടുംബത്തിന്റെ പേര്' },
  'auth.shareCode': { en: 'Share code', ml: 'പങ്കിടൽ കോഡ്' },

  // Common
  'common.cancel': { en: 'Cancel', ml: 'റദ്ദാക്കുക' },
  'common.back': { en: 'Back', ml: 'പിന്നിലേക്ക്' },
  'common.close': { en: 'Close', ml: 'അടയ്ക്കുക' },
};

/** Read the preferred language from localStorage, on the client only. */
function readStoredLang(): Lang | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(LANG_STORAGE_KEY) === 'ml' ? 'ml' : null;
  } catch {
    return null;
  }
}

function persistLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // ignore — localStorage may be unavailable
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Start with English for SSR/hydration consistency, then restore the saved
  // language after mount. This prevents hydration mismatch crashes.
  const [lang, setLang] = useState<Lang>('en');

  useEffect(() => {
    const saved = readStoredLang();
    if (saved) {
      // Non-urgent restore of the persisted language. startTransition keeps the
      // update out of the synchronous effect body (react-hooks/set-state-in-effect)
      // while still applying it right after mount — before the user notices.
      startTransition(() => setLang(saved));
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next: Lang = prev === 'en' ? 'ml' : 'en';
      persistLang(next);
      return next;
    });
  }, []);

  const setLangSafe = useCallback((next: Lang) => {
    setLang(next);
    persistLang(next);
  }, []);

  const t = useCallback((key: string, vars?: I18nVars) => {
    const entry = translations[key];
    let text = entry ? entry[lang] ?? entry.en ?? key : key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.split(`{${k}}`).join(String(v));
      }
    }
    return text;
  }, [lang]);

  const value = useMemo<I18nContextValue>(
    () => ({ lang, setLang: setLangSafe, toggleLang, t }),
    [lang, setLangSafe, toggleLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  // Fallback if context is not available — return English keys as-is
  // instead of throwing (which crashes the entire app).
  if (!ctx) {
    return {
      lang: 'en',
      setLang: () => {},
      toggleLang: () => {},
      t: (key) => key,
    };
  }
  return ctx;
}
