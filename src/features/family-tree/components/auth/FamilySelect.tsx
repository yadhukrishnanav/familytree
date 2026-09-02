'use client';

// Family select — list of the user's families with role badge, share-code
// copy button, switcher, and "create new / join with code" tiles.

import { useState } from 'react';
import { useAuth } from '../../auth';
import { useI18n } from '../../i18n';
import { Button } from '@/components/ui/button';
import { Users, Plus, LogIn, LogOut, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { LanguageToggle } from '../LanguageToggle';
import type { View } from './types';

export function FamilySelect({ setView }: { setView: (v: View) => void }) {
  const auth = useAuth();
  const { t } = useI18n();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyShareCode = async (familyId: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(familyId);
      toast.success('Share code copied!', { description: `"${code}" is ready to paste.` });
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{t('family.yourFamilies')}</h2>
              <p className="text-sm text-slate-500">{t('family.signedInAs', { email: auth.user?.email ?? '' })}</p>
            </div>
            <div className="flex items-center gap-1">
              <LanguageToggle />
              <button
                onClick={() => auth.signOut()}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
              >
                <LogOut className="h-4 w-4" />
                {t('family.signOut')}
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {auth.families.map((fam) => {
              const active = fam.id === auth.activeFamily?.id;
              return (
                <div
                  key={fam.id}
                  className={`rounded-2xl bg-white p-4 shadow ring-1 transition hover:shadow-md ${
                    active ? 'ring-2 ring-emerald-400' : 'ring-slate-200'
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">{fam.name}</div>
                        <div className="text-xs text-slate-500">
                          {fam.memberCount} {fam.memberCount === 1 ? t('family.member') : t('family.members')}
                        </div>
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      fam.role === 'admin'
                        ? 'bg-rose-100 text-rose-700'
                        : fam.role === 'owner'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-teal-100 text-teal-700'
                    }`}>
                      {fam.role}
                    </span>
                  </div>

                  <div className="mb-3 flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1.5">
                    <span className="text-[10px] font-medium uppercase text-slate-400">Code:</span>
                    <code className="flex-1 font-mono text-sm font-bold text-slate-700">{fam.shareCode}</code>
                    <button
                      onClick={() => copyShareCode(fam.id, fam.shareCode)}
                      className="rounded p-1 hover:bg-slate-200"
                      aria-label="Copy share code"
                    >
                      {copiedId === fam.id ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-slate-500" />
                      )}
                    </button>
                  </div>

                  <Button
                    onClick={() => auth.setActiveFamilyId(fam.id)}
                    className={`w-full ${
                      active
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                    variant={active ? 'default' : 'secondary'}
                  >
                    {active ? t('family.currentlyActive') : t('family.open')}
                  </Button>
                </div>
              );
            })}

            <button
              onClick={() => setView('family-create')}
              className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-emerald-400 hover:text-emerald-600"
            >
              <Plus className="h-6 w-6" />
              <span className="text-sm font-medium">{t('family.createNew')}</span>
            </button>
            <button
              onClick={() => setView('family-join')}
              className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-amber-400 hover:text-amber-600"
            >
              <LogIn className="h-6 w-6" />
              <span className="text-sm font-medium">{t('family.joinWithCode')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
