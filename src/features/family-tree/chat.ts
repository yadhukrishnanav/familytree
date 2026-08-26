// Family Tree — Chat helpers
// Loads + sends messages via the chat_messages Supabase table.
// In demo mode (no Supabase), messages are kept in localStorage only.

import { getSupabase, isSupabaseConfigured } from './supabase';

export interface ChatMessage {
  id: string;
  family_id: string;
  user_id: string;
  user_email: string;
  content: string;
  created_at: string;
}

const DEMO_CHAT_KEY = 'family-tree-demo-chat';

function loadDemoChat(familyId: string): ChatMessage[] {
  try {
    const all = JSON.parse(localStorage.getItem(DEMO_CHAT_KEY) ?? '{}');
    return all[familyId] ?? [];
  } catch {
    return [];
  }
}

function saveDemoChat(familyId: string, msgs: ChatMessage[]) {
  const all = (() => { try { return JSON.parse(localStorage.getItem(DEMO_CHAT_KEY) ?? '{}'); } catch { return {}; } })();
  all[familyId] = msgs;
  localStorage.setItem(DEMO_CHAT_KEY, JSON.stringify(all));
}

export async function fetchMessages(familyId: string, limit = 100): Promise<ChatMessage[]> {
  if (!isSupabaseConfigured) {
    return loadDemoChat(familyId).slice(-limit);
  }
  const client = getSupabase()!;
  const { data, error } = await client
    .from('chat_messages')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) {
    console.warn('fetchMessages failed', error);
    return [];
  }
  return (data as ChatMessage[]) ?? [];
}

export async function sendMessage(
  familyId: string,
  actor: { id: string; email: string },
  content: string,
): Promise<ChatMessage | null> {
  const trimmed = content.trim();
  if (!trimmed) return null;

  if (!isSupabaseConfigured) {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      family_id: familyId,
      user_id: actor.id,
      user_email: actor.email,
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    const all = loadDemoChat(familyId);
    all.push(msg);
    saveDemoChat(familyId, all);
    return msg;
  }

  const client = getSupabase()!;
  const { data, error } = await client
    .from('chat_messages')
    .insert({
      family_id: familyId,
      user_id: actor.id,
      user_email: actor.email,
      content: trimmed,
    })
    .select()
    .single();
  if (error) {
    console.warn('sendMessage failed', error);
    return null;
  }
  return data as ChatMessage;
}

export async function deleteMessage(messageId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    // Demo mode: delete from all families (cheap scan)
    for (const fid of Object.keys(JSON.parse(localStorage.getItem(DEMO_CHAT_KEY) ?? '{}'))) {
      const all = loadDemoChat(fid);
      const filtered = all.filter((m) => m.id !== messageId);
      if (filtered.length !== all.length) saveDemoChat(fid, filtered);
    }
    return;
  }
  const client = getSupabase()!;
  await client.from('chat_messages').delete().eq('id', messageId);
}

export function subscribeToMessages(
  familyId: string,
  onNew: (msg: ChatMessage) => void,
  onDelete: (id: string) => void,
): (() => void) | null {
  if (!isSupabaseConfigured) return null;
  const client = getSupabase()!;
  const channel = client
    .channel(`chat-${familyId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `family_id=eq.${familyId}` },
      (payload) => onNew(payload.new as ChatMessage),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'chat_messages', filter: `family_id=eq.${familyId}` },
      (payload) => onDelete(payload.old.id as string),
    )
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
