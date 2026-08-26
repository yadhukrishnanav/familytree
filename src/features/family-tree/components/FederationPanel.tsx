'use client';

// Family Tree — Federation panel
// Link to another family via their share code. View linked families. Unlink.

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Link2, Unlink, Users, TreePine, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabase, isSupabaseConfigured } from '../supabase';

interface Props {
  familyId: string;
  onClose: () => void;
}

interface LinkedFamily {
  linkId: string;
  familyId: string;
  name: string;
  shareCode: string;
}

export function FederationPanel({ familyId, onClose }: Props) {
  const [code, setCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState<LinkedFamily[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadLinked = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const client = getSupabase()!;
    // Fetch links where this family is family_a OR family_b
    const [a, b] = await Promise.all([
      client.from('family_links').select('id, family_b, families!family_links_family_b_fkey(id, name, share_code)').eq('family_a', familyId),
      client.from('family_links').select('id, family_a, families!family_links_family_a_fkey(id, name, share_code)').eq('family_b', familyId),
    ]);
    if (a.error || b.error) {
      console.warn('Failed to load linked families', a.error ?? b.error);
      setLoading(false);
      return;
    }
    const aRows = (a.data ?? []).map((r: any) => ({
      linkId: r.id,
      familyId: r.families?.id,
      name: r.families?.name ?? 'Unknown',
      shareCode: r.families?.share_code ?? '',
    }));
    const bRows = (b.data ?? []).map((r: any) => ({
      linkId: r.id,
      familyId: r.families?.id,
      name: r.families?.name ?? 'Unknown',
      shareCode: r.families?.share_code ?? '',
    }));
    setLinked([...aRows, ...bRows]);
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    Promise.resolve().then(async () => {
      if (!mounted) return;
      await loadLinked();
    });
    return () => { mounted = false; };
  }, [familyId]);

  const handleLink = async () => {
    setError(null);
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Enter a share code');
      return;
    }
    if (!isSupabaseConfigured) {
      setError('Multi-family federation requires a configured Supabase project.');
      return;
    }
    setLinking(true);
    const client = getSupabase()!;
    // Find the target family by share code
    const { data: target, error: findErr } = await client
      .from('families')
      .select('id, name, share_code')
      .eq('share_code', trimmed)
      .maybeSingle();
    if (findErr) {
      setError(findErr.message);
      setLinking(false);
      return;
    }
    if (!target) {
      setError(`No family found with share code "${trimmed}"`);
      setLinking(false);
      return;
    }
    if (target.id === familyId) {
      setError('You cannot link a family to itself');
      setLinking(false);
      return;
    }
    // Check if already linked
    const existing = linked.find((l) => l.familyId === target.id);
    if (existing) {
      setError(`Already linked to ${existing.name}`);
      setLinking(false);
      return;
    }
    // Insert link (always order: smaller id first to satisfy unique constraint)
    const [family_a, family_b] = [familyId, target.id].sort();
    const { error: insertErr } = await client
      .from('family_links')
      .insert({ family_a, family_b, created_by: null });
    if (insertErr) {
      setError(insertErr.message);
      setLinking(false);
      return;
    }
    toast.success(`Linked to ${target.name}`, { description: `Share code: ${target.share_code}` });
    setCode('');
    setLinking(false);
    await loadLinked();
  };

  const handleUnlink = async (linkId: string, name: string) => {
    if (!confirm(`Unlink from ${name}? You can re-link later.`)) return;
    const client = getSupabase()!;
    const { error } = await client.from('family_links').delete().eq('id', linkId);
    if (error) {
      toast.error('Failed to unlink', { description: error.message });
      return;
    }
    setLinked((prev) => prev.filter((l) => l.linkId !== linkId));
    toast.success(`Unlinked from ${name}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative h-full w-full max-w-md bg-white shadow-2xl ring-1 ring-slate-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-sm">
              <TreePine className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Linked families</h2>
              <p className="text-[10px] text-slate-500">Connect related trees (spouse&apos;s family, etc.)</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Link form */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Link another family by share code
            </label>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="AB12CD"
                className="font-mono uppercase"
                maxLength={8}
                onKeyDown={(e) => { if (e.key === 'Enter') handleLink(); }}
              />
              <Button onClick={handleLink} disabled={linking}>
                {linking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                <span className="ml-1">Link</span>
              </Button>
            </div>
            {error && (
              <div className="mt-2 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Linked families list */}
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Currently linked ({linked.length})
            </div>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
              </div>
            ) : linked.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-slate-200 py-8 text-center">
                <Users className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-500">No linked families yet</p>
                <p className="mt-1 text-xs text-slate-400">
                  Link to a spouse&apos;s tree or related family to see them here.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {linked.map((l) => (
                  <li
                    key={l.linkId}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-purple-400 text-white">
                      <TreePine className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-800">{l.name}</div>
                      <div className="text-[11px] text-slate-500">
                        Code: <code className="font-mono font-bold text-slate-700">{l.shareCode}</code>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleUnlink(l.linkId, l.name)}
                      className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                      title="Unlink"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!isSupabaseConfigured && (
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              <AlertCircle className="mr-1 inline h-3 w-3" />
              Federation requires Supabase to be configured. In demo mode, this feature is read-only.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
