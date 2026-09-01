'use client';

// Quick Access — family code only, for elders.
// One-shot flow: user enters code -> auto-create a guest account -> join family.

import { useState } from 'react';
import { useAuth } from '../../auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TreePine, AlertCircle } from 'lucide-react';
import type { View } from './types';
import { TIMING } from '../../constants';

export function QuickAccess({ auth, setView }: { auth: ReturnType<typeof useAuth>; setView: (v: View) => void }) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuickAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError('Enter your family code'); return; }
    setSubmitting(true);
    try {
      const guestId = Math.random().toString(36).slice(2, 10);
      const guestEmail = `guest_${guestId}@familytree.local`;
      const guestPassword = `Guest_${guestId}!`;
      // Sign up (auto-confirmed since mailer_autoconfirm=true)
      const signUpRes = await auth.signUp(guestEmail, guestPassword);
      if (signUpRes.error) {
        // If signup fails (e.g., email exists), try signing in
        const signInRes = await auth.signIn(guestEmail, guestPassword);
        if (signInRes.error) { setError(signInRes.error); setSubmitting(false); return; }
      }
      // Wait for auth state to propagate (user should be set now)
      await new Promise(r => setTimeout(r, TIMING.QUICKACCESS_AUTH_PROPAGATION));
      // Join the family with the code
      const joinRes = await auth.joinFamily(trimmed);
      if (joinRes.error) { setError(joinRes.error); setSubmitting(false); return; }
      // The auth context will now have the family set as active,
      // and page.tsx will render FamilyTree directly — no "Create a family" screen.
    } catch (e: any) { setError(e.message ?? 'Something went wrong'); }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
              <TreePine className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Family Tree</h1>
            <p className="text-sm text-slate-500 mt-1">Enter your family code to get started</p>
          </div>
          <div className="rounded-2xl bg-white/80 p-6 shadow-xl backdrop-blur-md ring-1 ring-slate-200">
            <form onSubmit={handleQuickAccess} className="space-y-4" noValidate>
              <div>
                <Label htmlFor="familyCode">Family code</Label>
                <Input id="familyCode" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="AB12CD" className="font-mono text-center text-lg font-bold tracking-[0.3em] uppercase" maxLength={8} autoFocus required />
                <p className="mt-1.5 text-xs text-slate-400">Ask your family member for the 6-character code.</p>
              </div>
              {error && <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
              <Button type="submit" disabled={submitting} className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600">{submitting ? 'Joining…' : 'Enter Family Tree'}</Button>
            </form>
          </div>
          <button onClick={() => { setView('sign-in'); setError(null); }} className="mt-4 w-full text-center text-xs text-slate-500 hover:text-emerald-600">← Sign in with email instead</button>
        </div>
      </div>
    </div>
  );
}
