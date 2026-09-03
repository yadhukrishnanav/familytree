'use client';

// Family Tree — Federation panel
// Link to another family via their share code. View linked families. Unlink.

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Link2, Unlink, Users, TreePine, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabase, isSupabaseConfigured } from '../supabase';
import {
  fetchLinkedFamilies,
  createFamilyLink,
  setLinkMembers,
  type LinkedFamilyInfo,
} from '../linkedFamilies';
import type { Person } from '../types';

interface Props {
  familyId: string;
  /** Our tree's people — used to pick the COMMON MEMBER who exists in both trees. */
  persons: Person[];
  onClose: () => void;
}

export function FederationPanel({ familyId, persons, onClose }: Props) {
  const [code, setCode] = useState('');
  const [commonMemberId, setCommonMemberId] = useState('');
  const [linking, setLinking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState<LinkedFamilyInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadLinked = async () => {
    const rows = await fetchLinkedFamilies(familyId);
    setLinked(rows);
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
    if (!commonMemberId) {
      setError('Select the common member — the person who exists in both trees (e.g. the daughter who married across).');
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
    // Insert link anchored at the common member (our side set now; the other
    // family's admin completes their side from their own panel).
    const linkRes = await createFamilyLink(familyId, target.id, commonMemberId);
    if (linkRes.error) {
      setError(linkRes.error);
      setLinking(false);
      return;
    }
    toast.success(`Linked to ${target.name}`, { description: `Share code: ${target.share_code}` });
    setCode('');
    setCommonMemberId('');
    setLinking(false);
    await loadLinked();
  };

  // Complete/correct OUR side's common-member anchor on an existing link.
  const handleSetOurMember = async (link: LinkedFamilyInfo, personId: string) => {
    const updates =
      link.ourSide === 'a' ? { member_a: personId } : { member_b: personId };
    const res = await setLinkMembers(link.linkId, updates);
    if (res.error) {
      toast.error('Could not set common member', { description: res.error });
      return;
    }
    toast.success('Common member updated');
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
            <div className="mt-2">
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Common member (required) — the person who exists in both trees
              </label>
              {persons.length === 0 ? (
                <p className="text-xs text-amber-600">Add people to your tree first — the link anchors at a person.</p>
              ) : (
                <select
                  value={commonMemberId}
                  onChange={(e) => setCommonMemberId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Select the linking person…</option>
                  {persons.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.firstName} {pr.lastName ?? ''}{pr.birthYear ? ` (${pr.birthYear})` : ''}
                    </option>
                  ))}
                </select>
              )}
              <p className="mt-1 text-[11px] text-slate-400">
                e.g. pick your daughter — the other family then picks her in their tree, so the link has an exact person-to-person route.
              </p>
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
                        {' · '}
                        {(() => {
                          const ours = persons.find((pr) => pr.id === l.ourMember);
                          const theirs = l.member;
                          if (ours && theirs) {
                            return <span className="text-emerald-600">Linked through {ours.firstName}{theirs ? '' : ''}</span>;
                          }
                          if (ours) return <span className="text-emerald-600">Through {ours.firstName} (their side pending)</span>;
                          return <span className="text-amber-600">Common member not set</span>;
                        })()}
                      </div>
                      {!l.ourMember && (
                        <select
                          value=""
                          onChange={(e) => { if (e.target.value) handleSetOurMember(l, e.target.value); }}
                          className="mt-1 w-full rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-slate-700"
                        >
                          <option value="">Set your side&apos;s common member…</option>
                          {persons.map((pr) => (
                            <option key={pr.id} value={pr.id}>
                              {pr.firstName} {pr.lastName ?? ''}
                            </option>
                          ))}
                        </select>
                      )}
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
