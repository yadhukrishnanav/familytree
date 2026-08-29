'use client';

// Family Tree — i18n (English + Malayalam)
// Lightweight translation system using React Context.

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

// Translation dictionary — keyed by English string
const translations: Record<string, Record<Lang, string>> = {
  // Auth page
  'Family Tree': { en: 'Family Tree', ml: 'കുടുംബവൃക്ഷം' },
  'Build, visualize, and share your family\'s story': { en: 'Build, visualize, and share your family\'s story', ml: 'നിങ്ങളുടെ കുടുംബത്തിന്റെ കഥ പടുത്തുയർത്തുക, പങ്കിടുക' },
  'Sign in': { en: 'Sign in', ml: 'പ്രവേശിക്കുക' },
  'Create account': { en: 'Create account', ml: 'അക്കൗണ്ട് സൃഷ്ടിക്കുക' },
  'Email': { en: 'Email', ml: 'ഇമെയിൽ' },
  'Password': { en: 'Password', ml: 'രഹസ്യവാക്ക്' },
  'Confirm password': { en: 'Confirm password', ml: 'രഹസ്യവാക്ക് വീണ്ടും' },
  'Please wait...': { en: 'Please wait...', ml: 'ദയവായി കാത്തിരിക്കുക...' },
  '✉️ Sign in with email link (no password needed)': { en: '✉️ Sign in with email link (no password needed)', ml: '✉️ ഇമെയിൽ ലിങ്ക് വഴി പ്രവേശിക്കുക (രഹസ്യവാക്ക് വേണ്ട)' },
  '← Sign in with password instead': { en: '← Sign in with password instead', ml: '← രഹസ്യവാക്ക് ഉപയോഗിച്ച് പ്രവേശിക്കുക' },
  'Have a family code?': { en: 'Have a family code?', ml: 'കുടുംബ കോഡ് ഉണ്ടോ?' },
  '🔑 Enter Family Code': { en: '🔑 Enter Family Code', ml: '🔑 കുടുംബ കോഡ് നൽകുക' },
  'Simplest way to join — no email needed': { en: 'Simplest way to join — no email needed', ml: 'ചേരാൻ എളുപ്പവഴി — ഇമെയിൽ വേണ്ട' },
  'Family code': { en: 'Family code', ml: 'കുടുംബ കോഡ്' },
  'Ask your family member for the 6-character code.': { en: 'Ask your family member for the 6-character code.', ml: 'നിങ്ങളുടെ കുടുംബാംഗത്തിൽ നിന്ന് 6 പ്രതീക കോഡ് ചോദിക്കുക.' },
  'Enter Family Tree': { en: 'Enter Family Tree', ml: 'കുടുംബവൃക്ഷത്തിലേക്ക് പ്രവേശിക്കുക' },
  'Joining…': { en: 'Joining…', ml: 'ചേരുന്നു…' },
  '← Sign in with email instead': { en: '← Sign in with email instead', ml: '← ഇമെയിൽ ഉപയോഗിച്ച് പ്രവേശിക്കുക' },
  'Welcome': { en: 'Welcome', ml: 'സ്വാഗതം' },
  'Create a new family tree, or join an existing one with a share code.': { en: 'Create a new family tree, or join an existing one with a share code.', ml: 'പുതിയ കുടുംബവൃക്ഷം സൃഷ്ടിക്കുക, അല്ലെങ്കിൽ ഷെയർ കോഡ് ഉപയോഗിച്ച് നിലവിലുള്ളതിൽ ചേരുക.' },
  'Create a family': { en: 'Create a family', ml: 'കുടുംബം സൃഷ്ടിക്കുക' },
  'Start a new tree from scratch': { en: 'Start a new tree from scratch', ml: 'പുതിയ വൃക്ഷം ആരംഭിക്കുക' },
  'Join with a code': { en: 'Join with a code', ml: 'കോഡ് ഉപയോഗിച്ച് ചേരുക' },
  'Enter a share code from a family member': { en: 'Enter a share code from a family member', ml: 'കുടുംബാംഗത്തിൽ നിന്ന് ഷെയർ കോഡ് നൽകുക' },
  'Sign out': { en: 'Sign out', ml: 'പുറത്തുകടക്കുക' },
  'Family name': { en: 'Family name', ml: 'കുടുംബത്തിന്റെ പേര്' },
  'Back': { en: 'Back', ml: 'തിരികെ' },
  'Create family': { en: 'Create family', ml: 'കുടുംബം സൃഷ്ടിക്കുക' },
  'Creating...': { en: 'Creating...', ml: 'സൃഷ്ടിക്കുന്നു...' },
  'Your families': { en: 'Your families', ml: 'നിങ്ങളുടെ കുടുംബങ്ങൾ' },
  'Share code': { en: 'Share code', ml: 'ഷെയർ കോഡ്' },
  'Currently active': { en: 'Currently active', ml: 'നിലവിൽ സജീവം' },
  'Open': { en: 'Open', ml: 'തുറക്കുക' },

  // Toolbar
  'Add Person': { en: 'Add Person', ml: 'വ്യക്തി ചേർക്കുക' },
  'Person': { en: 'Person', ml: 'വ്യക്തി' },
  'Event': { en: 'Event', ml: 'സംഭവം' },
  'Search': { en: 'Search', ml: 'തിരയുക' },
  'Map': { en: 'Map', ml: 'ഭൂപടം' },
  'Export PNG': { en: 'Export PNG', ml: 'PNG കയറ്റുമതി' },
  'Export PDF': { en: 'Export PDF', ml: 'PDF കയറ്റുമതി' },
  'Import from CSV': { en: 'Import from CSV', ml: 'CSV നിന്ന് ഇറക്കുമതി' },
  'Manage members': { en: 'Manage members', ml: 'അംഗങ്ങളെ കൈകാര്യം ചെയ്യുക' },
  'Linked families': { en: 'Linked families', ml: 'ബന്ധിപ്പിച്ച കുടുംബങ്ങൾ' },

  // PersonForm
  'First name *': { en: 'First name *', ml: 'പേരിന്റെ ആദ്യഭാഗം *' },
  'Last name': { en: 'Last name', ml: 'പേരിന്റെ അവസാനഭാഗം' },
  'Birth year *': { en: 'Birth year *', ml: 'ജനന വർഷം *' },
  'Death year': { en: 'Death year', ml: 'മരണ വർഷം' },
  'Gender': { en: 'Gender', ml: 'ലിംഗം' },
  'Male': { en: 'Male', ml: 'പുരുഷൻ' },
  'Female': { en: 'Female', ml: 'സ്ത്രീ' },
  'Other': { en: 'Other', ml: 'മറ്റ്' },
  'Occupation': { en: 'Occupation', ml: 'തൊഴിൽ' },
  'Birthplace': { en: 'Birthplace', ml: 'ജനനസ്ഥലം' },
  'Phone': { en: 'Phone', ml: 'ഫോൺ' },
  'Email': { en: 'Email', ml: 'ഇമെയിൽ' },
  'Social media (optional)': { en: 'Social media (optional)', ml: 'സോഷ്യൽ മീഡിയ (ഓപ്ഷണൽ)' },
  'No social media added yet.': { en: 'No social media added yet.', ml: 'സോഷ്യൽ മീഡിയ ഇതുവരെ ഇല്ല.' },
  '+ Add social media': { en: '+ Add social media', ml: '+ സോഷ്യൽ മീഡിയ ചേർക്കുക' },
  'Link to family': { en: 'Link to family', ml: 'കുടുംബവുമായി ബന്ധിപ്പിക്കുക' },
  'Standalone': { en: 'Standalone', ml: 'സ്വതന്ത്രം' },
  'Spouse of': { en: 'Spouse of', ml: 'ഭാര്യ/ഭർത്താവ്' },
  'Child of': { en: 'Child of', ml: 'മകൻ/മകൾ' },
  'Parent of': { en: 'Parent of', ml: 'രക്ഷിതാവ്' },
  'Marry which person?': { en: 'Marry which person?', ml: 'ആരെ വിവാഹം ചെയ്യണം?' },
  'Who is the parent?': { en: 'Who is the parent?', ml: 'ആരാണ് രക്ഷിതാവ്?' },
  'Who is the child?': { en: 'Who is the child?', ml: 'ആരാണ് മകൻ/മകൾ?' },
  'Marriage year *': { en: 'Marriage year *', ml: 'വിവാഹ വർഷം *' },
  'Select a person…': { en: 'Select a person…', ml: 'ഒരാളെ തിരഞ്ഞെടുക്കുക…' },
  'Cancel': { en: 'Cancel', ml: 'റദ്ദാക്കുക' },
  'Add person': { en: 'Add person', ml: 'വ്യക്തി ചേർക്കുക' },
  'Save changes': { en: 'Save changes', ml: 'മാറ്റങ്ങൾ സൂക്ഷിക്കുക' },
  'Saving...': { en: 'Saving...', ml: 'സൂക്ഷിക്കുന്നു...' },
  'Photo (optional)': { en: 'Photo (optional)', ml: 'ഫോട്ടോ (ഓപ്ഷണൽ)' },
  'Upload photo': { en: 'Upload photo', ml: 'ഫോട്ടോ അപ്ലോഡ്' },
  'Change photo': { en: 'Change photo', ml: 'ഫോട്ടോ മാറ്റുക' },
  'Uploading...': { en: 'Uploading...', ml: 'അപ്ലോഡ് ചെയ്യുന്നു...' },

  // EventForm
  'Year *': { en: 'Year *', ml: 'വർഷം *' },
  'Title *': { en: 'Title *', ml: 'തലക്കെട്ട് *' },
  'Description': { en: 'Description', ml: 'വിവരണം' },
  'Event type': { en: 'Event type', ml: 'സംഭവ തരം' },
  'Photo album link': { en: 'Photo album link', ml: 'ഫോട്ടോ ആൽബം ലിങ്ക്' },
  'Related people': { en: 'Related people', ml: 'ബന്ധപ്പെട്ട ആളുകൾ' },
  'Add event': { en: 'Add event', ml: 'സംഭവം ചേർക്കുക' },
  'Save event': { en: 'Save event', ml: 'സംഭവം സൂക്ഷിക്കുക' },

  // Detail panel
  'Edit': { en: 'Edit', ml: 'തിരുത്തുക' },
  'Born in': { en: 'Born in', ml: 'ജനിച്ചത്' },
  'Spouse': { en: 'Spouse', ml: 'ഭാര്യ/ഭർത്താവ്' },
  'Parents': { en: 'Parents', ml: 'മാതാപിതാക്കൾ' },
  'Children': { en: 'Children', ml: 'മക്കൾ' },

  // Timeline
  'Timeline': { en: 'Timeline', ml: 'കാലരേഖ' },
  'events': { en: 'events', ml: 'സംഭവങ്ങൾ' },
  'No events yet.': { en: 'No events yet.', ml: 'സംഭവങ്ങൾ ഇല്ല.' },

  // Empty state
  'Start your family tree': { en: 'Start your family tree', ml: 'നിങ്ങളുടെ കുടുംബവൃക്ഷം ആരംഭിക്കുക' },
  'Add your first family member to begin building your tree.': { en: 'Add your first family member to begin building your tree.', ml: 'നിങ്ങളുടെ വൃക്ഷം പണിയാൻ ആദ്യത്തെ കുടുംബാംഗത്തെ ചേർക്കുക.' },
  'Add first person': { en: 'Add first person', ml: 'ആദ്യത്തെ വ്യക്തിയെ ചേർക്കുക' },

  // Search
  'Search by name, place, or occupation…': { en: 'Search by name, place, or occupation…', ml: 'പേര്, സ്ഥലം, തൊഴിൽ എന്നിവ ഉപയോഗിച്ച് തിരയുക…' },
  'Start typing to search your family.': { en: 'Start typing to search your family.', ml: 'നിങ്ങളുടെ കുടുംബം തിരയാൻ ടൈപ്പ് ചെയ്യാനാരംഭിക്കുക.' },

  // Panels
  'Family chat': { en: 'Family chat', ml: 'കുടുംബ ചാറ്റ്' },
  'Family map': { en: 'Family map', ml: 'കുടുംബ ഭൂപടം' },
  'Recent activity': { en: 'Recent activity', ml: 'സമീപകാല പ്രവർത്തനങ്ങൾ' },
  'Family members': { en: 'Family members', ml: 'കുടുംബാംഗങ്ങൾ' },
  'Type a message…': { en: 'Type a message…', ml: 'സന്ദേശം ടൈപ്പ് ചെയ്യുക…' },
  'No messages yet': { en: 'No messages yet', ml: 'സന്ദേശങ്ങൾ ഇല്ല' },
  'Say hello to your family!': { en: 'Say hello to your family!', ml: 'നിങ്ങളുടെ കുടുംബത്തിന് ഹലോ പറയുക!' },

  // Misc
  'Synced': { en: 'Synced', ml: 'സിൻക് ചെയ്തു' },
  'Syncing…': { en: 'Syncing…', ml: 'സിൻക് ചെയ്യുന്നു…' },
  'Loading Family Tree…': { en: 'Loading Family Tree…', ml: 'കുടുംബവൃക്ഷം ലോഡ് ചെയ്യുന്നു…' },
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en');

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === 'en' ? 'ml' : 'en'));
  }, []);

  const t = useCallback((key: string) => {
    const entry = translations[key];
    if (!entry) return key; // fallback to English key
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
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
