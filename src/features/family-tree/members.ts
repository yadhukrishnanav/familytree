// Family Tree — Member management helpers

import { getSupabase, isSupabaseConfigured } from './supabase';

export interface FamilyMember {
  user_id: string;
  email: string | null;
  role: 'admin' | 'owner' | 'editor';
  created_at: string;
}

export async function fetchFamilyMembers(familyId: string): Promise<FamilyMember[]> {
  if (!isSupabaseConfigured) {
    // Demo mode: return localStorage members (we only know about the current user)
    // For demo, fabricate the current user as the only member
    return [];
  }
  const client = getSupabase()!;
  // We join auth.users via the email in family_members, but RLS prevents reading auth.users directly.
  // Instead, we use the user_email column we've been writing into activity_log/chat_messages as a fallback.
  // Simplest: just query family_members (no email) and look up emails via a server-side lookup later.
  const { data, error } = await client
    .from('family_members')
    .select('user_id, role, created_at')
    .eq('family_id', familyId)
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('fetchFamilyMembers failed', error);
    return [];
  }
  // Try to enrich with email by reading the most recent activity_log row per user
  const members = (data ?? []) as Omit<FamilyMember, 'email'>[];
  const enriched: FamilyMember[] = [];
  for (const m of members) {
    const { data: lastActivity } = await client
      .from('activity_log')
      .select('user_email')
      .eq('family_id', familyId)
      .eq('user_id', m.user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    enriched.push({
      ...m,
      email: (lastActivity as any)?.user_email ?? null,
    });
  }
  return enriched;
}

export async function updateMemberRole(
  familyId: string,
  userId: string,
  role: 'admin' | 'owner' | 'editor',
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) {
    return { error: 'Member management requires a configured Supabase project.' };
  }
  const client = getSupabase()!;
  const { error } = await client
    .from('family_members')
    .update({ role })
    .eq('family_id', familyId)
    .eq('user_id', userId);
  if (error) return { error: error.message };
  return {};
}

export async function removeMember(
  familyId: string,
  userId: string,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) {
    return { error: 'Member management requires a configured Supabase project.' };
  }
  const client = getSupabase()!;
  const { error } = await client
    .from('family_members')
    .delete()
    .eq('family_id', familyId)
    .eq('user_id', userId);
  if (error) return { error: error.message };
  return {};
}
