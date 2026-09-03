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
    client
      .from('family_links')
      .select('id, family_b, families!family_links_family_b_fkey(id, name, share_code)')
      .eq('family_a', familyId),
    client
      .from('family_links')
      .select('id, family_a, families!family_links_family_a_fkey(id, name, share_code)')
      .eq('family_b', familyId),
  ]);
  if (a.error || b.error) {
    console.warn('fetchLinkedFamilies failed', a.error ?? b.error);
    return [];
  }
  const map = (rows: any[] | null, key: 'families'): LinkedFamilyInfo[] =>
    (rows ?? []).map((r) => ({
      linkId: r.id as string,
      familyId: r[key]?.id as string,
      name: (r[key]?.name as string) ?? 'Unknown',
      shareCode: (r[key]?.share_code as string) ?? '',
    }));
  return [...map(a.data, 'families'), ...map(b.data, 'families')];
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
