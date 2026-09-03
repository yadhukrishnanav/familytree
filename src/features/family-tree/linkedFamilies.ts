'use client';

// Family Tree — Linked families (federation) data access
// Shared by the FederationPanel (manage links), the canvas chips bar
// (navigation) and the ghost overlay (read-only preview of the linked tree).
//
// Link model: family_links rows store two family UUIDs (family_a, family_b —
// sorted so either side can create the link). The share code is only used to
// LOOK UP the target family when creating a link; it is not the link key.
//
// Reading the linked tree requires the get_linked_family_tree RPC (see
// supabase/fix-linked-family-reads.sql): persons/family_units RLS only allows
// direct members. If the RPC is missing (patch not applied yet), tree fetches
// return null and the UI degrades to chips-only — it must never throw.

import { getSupabase, isSupabaseConfigured } from './supabase';
import type { FamilyUnitRow, PersonRow } from './supabase';
import { rowToPerson, rowToUnit } from './sync';
import type { FamilyUnit, Person } from './types';

export interface LinkedFamilyInfo {
  linkId: string;
  familyId: string;
  name: string;
  shareCode: string;
  /** Common-member anchor: person row in the linked family's tree (member_a/member_b are absolute; this is THEIR side). */
  member?: string | null;
  /** Common-member anchor: person row in OUR family's tree (our side). */
  ourMember?: string | null;
  /** Which absolute column (family_a/family_b) OUR family occupies on this link row. */
  ourSide: 'a' | 'b';
}

const LINK_SELECT_A =
  'id, family_b, member_a, member_b, families!family_links_family_b_fkey(id, name, share_code)';
const LINK_SELECT_B =
  'id, family_a, member_a, member_b, families!family_links_family_a_fkey(id, name, share_code)';

function toLinkedFamily(row: any, side: 'a' | 'b'): LinkedFamilyInfo {
  const fam = row.families;
  return {
    linkId: row.id as string,
    familyId: fam?.id as string,
    name: (fam?.name as string) ?? 'Unknown',
    shareCode: (fam?.share_code as string) ?? '',
    // Absolute columns → relative: when the linked family is on side B, its
    // anchor is member_b and ours is member_a, and vice versa.
    member: side === 'a' ? (row.member_b ?? null) : (row.member_a ?? null),
    ourMember: side === 'a' ? (row.member_a ?? null) : (row.member_b ?? null),
    ourSide: side,
  };
}

export interface LinkedTree {
  persons: Record<string, Person>;
  familyUnits: FamilyUnit[];
}

/**
 * All families linked to `familyId` (either direction of the link).
 */
export async function fetchLinkedFamilies(familyId: string): Promise<LinkedFamilyInfo[]> {
  if (!isSupabaseConfigured) return [];
  const client = getSupabase()!;

  // Links where this family is family_a (join the B side) or family_b (join the A side)
  const [a, b] = await Promise.all([
    client.from('family_links').select(LINK_SELECT_A).eq('family_a', familyId),
    client.from('family_links').select(LINK_SELECT_B).eq('family_b', familyId),
  ]);
  if (a.error || b.error) {
    console.warn('fetchLinkedFamilies failed', a.error ?? b.error);
    return [];
  }
  return [
    ...(a.data ?? []).map((r) => toLinkedFamily(r, 'a')),
    ...(b.data ?? []).map((r) => toLinkedFamily(r, 'b')),
  ];
}

/**
 * Create a link anchored at the common member (a person who exists in both
 * trees — our side's row is set now; the other family fills theirs in).
 */
export async function createFamilyLink(
  ourFamilyId: string,
  targetFamilyId: string,
  ourMemberPersonId: string,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: 'Federation requires a configured Supabase project.' };
  const client = getSupabase()!;
  const [family_a, family_b] = [ourFamilyId, targetFamilyId].sort();
  // member_a/member_b are absolute: whichever side we are gets the anchor.
  const member_a = ourFamilyId === family_a ? ourMemberPersonId : null;
  const member_b = ourFamilyId === family_b ? ourMemberPersonId : null;
  const { error } = await client
    .from('family_links')
    .insert({ family_a, family_b, member_a, member_b });
  if (error) return { error: error.message };
  return {};
}

/**
 * Set/replace the common-member anchors on an existing link. Each admin fills
 * in their own side's person row; the trigger validates family ownership.
 */
export async function setLinkMembers(
  linkId: string,
  updates: { member_a?: string | null; member_b?: string | null },
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: 'Federation requires a configured Supabase project.' };
  const client = getSupabase()!;
  const { error } = await client.from('family_links').update(updates).eq('id', linkId);
  if (error) return { error: error.message };
  return {};
}

/**
 * Read-only snapshot of a linked family's tree via the
 * get_linked_family_tree RPC. Returns null when unavailable (demo mode,
 * RPC patch not applied yet, or not actually linked) — callers should hide
 * the ghost preview, not crash.
 */
export async function fetchLinkedTree(familyId: string): Promise<LinkedTree | null> {
  if (!isSupabaseConfigured) return null;
  const client = getSupabase()!;
  const { data, error } = await client.rpc('get_linked_family_tree', {
    p_family_id: familyId,
  });
  if (error) {
    console.warn(
      'get_linked_family_tree failed — run supabase/fix-linked-family-reads.sql to enable ghost previews.',
      error,
    );
    return null;
  }
  const row = (data as Array<{ persons: PersonRow[]; family_units: FamilyUnitRow[] }> | null)?.[0];
  if (!row) return null;
  const persons: Record<string, Person> = {};
  for (const r of row.persons ?? []) persons[r.id] = rowToPerson(r);
  const familyUnits: FamilyUnit[] = (row.family_units ?? []).map(rowToUnit);
  return { persons, familyUnits };
}
