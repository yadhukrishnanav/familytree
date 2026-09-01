'use client';

// Join an existing family with a share code.

import { useState } from 'react';
import { useAuth } from '../../auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { View } from './types';

export function JoinFamily({ setView }: { setView: (v: View) => void }) {
  const auth = useAuth();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await auth.joinFamily(code);
    setSubmitting(false);
    if (res.error) setError(res.error);
    else setView('family-select');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white/80 p-6 shadow-xl backdrop-blur-md ring-1 ring-slate-200">
          <h2 className="mb-4 text-xl font-bold text-slate-800">Join a family</h2>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label htmlFor="shareCode">Share code</Label>
              <Input
                id="shareCode"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="AB12CD"
                className="font-mono uppercase"
                autoFocus
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                Ask a family member for the 6-character code shown in their header.
              </p>
            </div>
            {error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setView('family-select')}>
                Back
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Joining...' : 'Join family'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
