'use client';

// Family Tree — Family Switcher Dialog
// Lets a signed-in user:
//   1. Switch between families they already belong to.
//   2. Create a NEW family (without signing out first).
//   3. JOIN an existing family with a share code (without signing out first).
//
// Previously a registered user with one family was stuck on that family — to
// create or join another they had to sign out and start over. This dialog
// removes that restriction.

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Plus, LogIn, Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import type { AuthContextValue } from '../auth';

interface Props {
  open: boolean;
  onClose: () => void;
  auth: AuthContextValue;
}

export function FamilySwitcherDialog({ open, onClose, auth }: Props) {
  const [mode, setMode] = useState<'switch' | 'create' | 'join'>('switch');
  const [newFamilyName, setNewFamilyName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const reset = () => {
    setMode('switch');
    setNewFamilyName('');
    setJoinCode('');
    setSubmitting(false);
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newFamilyName.trim()) {
      setError('Family name is required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await auth.createFamily(newFamilyName.trim());
      if (res.error) {
        setError(res.error);
        setSubmitting(false);
        return;
      }
      toast.success('Family created', {
        description: `"${newFamilyName.trim()}" is ready. You can switch to it any time.`,
      });
      reset();
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Could not create family');
      setSubmitting(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError('Share code is required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await auth.joinFamily(code);
      if (res.error) {
        setError(res.error);
        setSubmitting(false);
        return;
      }
      toast.success('Joined family', {
        description: `You're now a member of "${res.family?.name ?? code}".`,
      });
      reset();
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Could not join family');
      setSubmitting(false);
    }
  };

  const handleSwitch = (familyId: string) => {
    auth.setActiveFamilyId(familyId);
    toast.success('Switched family');
    reset();
    onClose();
  };

  const copyCode = async (familyId: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(familyId);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-800">Your families</DialogTitle>
          <DialogDescription>
            Signed in as {auth.user?.email}. Switch families, create a new one, or join with a code.
          </DialogDescription>
        </DialogHeader>

        {mode === 'switch' && (
          <div className="space-y-3">
            {/* List of families the user belongs to */}
            <div className="max-h-[40vh] space-y-2 overflow-y-auto pr-1">
              {auth.families.map((fam) => {
                const active = fam.id === auth.activeFamily?.id;
                return (
                  <div
                    key={fam.id}
                    className={`rounded-xl border p-3 transition ${
                      active
                        ? 'border-slate-400 bg-slate-50 ring-1 ring-slate-300'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-500 to-slate-700 text-white">
                          <Users className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-800">{fam.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {fam.memberCount} {fam.memberCount === 1 ? 'member' : 'members'} · {fam.role}
                          </div>
                        </div>
                      </div>
                      {active && (
                        <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                          <Check className="h-2.5 w-2.5" /> Active
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      <code className="flex-1 rounded-md bg-slate-50 px-2 py-1 font-mono text-[11px] font-bold tracking-wider text-slate-600">
                        {fam.shareCode}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyCode(fam.id, fam.shareCode)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        title="Copy share code"
                      >
                        {copiedId === fam.id ? (
                          <Check className="h-3.5 w-3.5 text-slate-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      {!active && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => handleSwitch(fam.id)}
                          className="ml-1"
                        >
                          Open
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Create / Join new family */}
            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => { setMode('create'); setError(null); }}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 px-3 py-3 text-xs font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                Create new family
              </button>
              <button
                type="button"
                onClick={() => { setMode('join'); setError(null); }}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 px-3 py-3 text-xs font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-50"
              >
                <LogIn className="h-4 w-4" />
                Join with a code
              </button>
            </div>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <Label htmlFor="newFamilyName">Family name</Label>
              <Input
                id="newFamilyName"
                value={newFamilyName}
                onChange={(e) => setNewFamilyName(e.target.value)}
                placeholder="e.g. The Nair Family"
                autoFocus
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                You can switch between all your families any time from the header.
              </p>
            </div>
            {error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => { setMode('switch'); setError(null); }} disabled={submitting}>
                Back
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create family'}
              </Button>
            </div>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className="space-y-3">
            <div>
              <Label htmlFor="joinCode">Share code</Label>
              <Input
                id="joinCode"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="AB12CD"
                className="font-mono uppercase"
                autoFocus
                required
                maxLength={8}
              />
              <p className="mt-1 text-xs text-slate-500">
                Ask a family member for the 6-character code shown in their header.
              </p>
            </div>
            {error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => { setMode('switch'); setError(null); }} disabled={submitting}>
                Back
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Joining…' : 'Join family'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
