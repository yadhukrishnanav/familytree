'use client';

// Family Tree — language toggle (English / Malayalam)
// Small button that lives in the header / auth screen.

import { Languages } from 'lucide-react';
import { useI18n } from '../i18n';

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { lang, toggleLang } = useI18n();

  return (
    <button
      type="button"
      onClick={toggleLang}
      aria-label={lang === 'en' ? 'മലയാളം' : 'English'}
      title={lang === 'en' ? 'മലയാളം' : 'English'}
      className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-semibold transition hover:bg-slate-100 hover:text-slate-700 ${className}`}
    >
      <Languages className="h-3.5 w-3.5" />
      {lang === 'en' ? 'മ' : 'EN'}
    </button>
  );
}
