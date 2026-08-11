// Family Tree — Supabase client + DB types + photo helpers
// Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from env.
// Falls back to "demo mode" (no real backend) when env vars are missing or placeholder.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Treat empty/placeholder values as "not configured"
export const isSupabaseConfigured =
  SUPABASE_URL.trim().length > 0 &&
  SUPABASE_ANON_KEY.trim().length > 0 &&
  !SUPABASE_URL.includes('your-') &&
  !SUPABASE_URL.includes('placeholder') &&
  !SUPABASE_ANON_KEY.includes('your-') &&
  !SUPABASE_ANON_KEY.includes('placeholder') &&
  SUPABASE_URL.startsWith('http');

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (_client) return _client;
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return _client;
}

// ---- DB row types (snake_case as in Supabase) ----
export interface PersonRow {
  id: string;
  family_id: string;
  first_name: string;
  last_name: string | null;
  birth_year: number | null;
  death_year: number | null;
  gender: string;
  avatar_colors: string[];
  occupation: string | null;
  birth_place: string | null;
  photo_url: string | null;
}

export interface FamilyUnitRow {
  id: string;
  family_id: string;
  partner1_id: string;
  partner2_id: string | null;
  children_ids: string[];
  marriage_year: number | null;
}

export interface TimelineEventRow {
  id: string;
  family_id: string;
  year: number;
  title: string;
  description: string | null;
  photo_url: string | null;
  person_ids: string[];
  icon: string;
  color: string;
}

export interface FamilyRow {
  id: string;
  name: string;
  share_code: string;
  created_at: string;
}

export interface FamilyMemberRow {
  user_id: string;
  family_id: string;
  role: 'owner' | 'editor';
  created_at: string;
}

// ---- Photo upload helpers ----
// Uploads a File to the 'photos' bucket and returns the public URL.
// Falls back to data URL when Supabase isn't configured.
export async function uploadPhoto(
  file: File | Blob,
  familyId: string,
  kind: 'person' | 'event',
): Promise<string> {
  // Demo mode: return a data URL
  const client = getSupabase();
  if (!client) {
    return await fileToDataUrl(file);
  }
  const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const path = `${familyId}/${kind}/${crypto.randomUUID()}.${ext}`;
  const { error } = await client.storage.from('photos').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/png',
  });
  if (error) {
    console.warn('Supabase upload failed, falling back to data URL', error);
    return await fileToDataUrl(file);
  }
  const { data } = client.storage.from('photos').getPublicUrl(path);
  return data.publicUrl;
}

export async function deletePhoto(url: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  // Only delete if it's a Supabase storage URL
  if (!url.includes('/storage/v1/object/public/photos/')) return;
  const idx = url.indexOf('/photos/');
  if (idx < 0) return;
  const path = decodeURIComponent(url.slice(idx + '/photos/'.length));
  await client.storage.from('photos').remove([path]);
}

export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function dataUrlToFile(dataUrl: string, filename = 'photo.png'): File {
  const [meta, base64] = dataUrl.split(',');
  const mimeMatch = meta.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}
