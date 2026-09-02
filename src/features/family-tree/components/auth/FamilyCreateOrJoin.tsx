'use client';

// Welcome screen shown when a signed-in user has no families yet.
// Two buttons: create a new family, or join with a share code.

import { useAuth } from '../../auth';
import { useI18n } from '../../i18n';
import { TreePine, Plus, LogIn } from 'lucide-react';
import { LanguageToggle } from '../LanguageToggle';
import type { View } from './types';

export function FamilyCreateOrJoin({ setView }: { setView: (v: View) => void }) {
  const auth = useAuth();
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="mb-2 flex justify-end"><LanguageToggle /></div>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
            <TreePine className="h-7 w-7 text-white" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-slate-800">{t('auth.welcomeTitle', { email: auth.user?.email ?? '' })}</h2>
          <p className="mb-6 text-sm text-slate-500">
            {t('auth.welcomeDesc')}
          </p>
          <div className="space-y-3">
            <button
              onClick={() => setView('family-create')}
              className="flex w-full items-center gap-3 rounded-xl bg-white p-4 text-left shadow ring-1 ring-slate-200 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-slate-800">{t('auth.createFamily')}</div>
                <div className="text-xs text-slate-500">{t('auth.createFamilyDesc')}</div>
              </div>
            </button>
            <button
              onClick={() => setView('family-join')}
              className="flex w-full items-center gap-3 rounded-xl bg-white p-4 text-left shadow ring-1 ring-slate-200 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-600">
                <LogIn className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-slate-800">{t('auth.joinFamily')}</div>
                <div className="text-xs text-slate-500">{t('auth.joinFamilyDesc')}</div>
              </div>
            </button>
          </div>
          <button
            onClick={() => auth.signOut()}
            className="mt-6 text-xs text-slate-400 hover:text-slate-600"
          >
            {t('family.signOut')}
          </button>
          <p className="mt-4 text-center text-[12px] font-medium text-slate-800">
            {t('app.footer')}
          </p>
        </div>
      </div>
    </div>
  );
}
