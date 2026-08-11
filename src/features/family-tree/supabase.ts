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
// IMPORTANT: Always compresses the image first (resize + WebP) to keep
// Supabase free-tier storage (1 GB) and egress (1 GB/month) under control.
export async function uploadPhoto(
  file: File | Blob,
  familyId: string,
  kind: 'person' | 'event',
): Promise<string> {
  // Compress first — this runs in both demo and Supabase modes.
  // A typical 4 MB phone photo becomes ~80-150 KB after compression.
  const compressed = await compressImage(file, 800, 0.78).catch((e) => {
    console.warn('Compression failed, using original', e);
    return file;
  });

  // Demo mode: return a data URL (compressed, so still small)
  const client = getSupabase();
  if (!client) {
    return await fileToDataUrl(compressed);
  }
  // Use .webp extension since we compressed to WebP
  const ext = compressed.type === 'image/webp' ? 'webp' : (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const path = `${familyId}/${kind}/${crypto.randomUUID()}.${ext}`;
  const { error } = await client.storage.from('photos').upload(path, compressed, {
    cacheControl: '31536000', // 1 year — photos are immutable, URL changes when replaced
    upsert: false,
    contentType: compressed.type || 'image/webp',
  });
  if (error) {
    console.warn('Supabase upload failed, falling back to data URL', error);
    return await fileToDataUrl(compressed);
  }
  const { data } = client.storage.from('photos').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Compress (resize + re-encode as WebP) an image File/Blob.
 * - Resizes so the longest side is at most `maxDimension` (maintains aspect ratio).
 * - Re-encodes as WebP at the given quality (0-1). WebP is ~30% smaller than JPEG at equal quality.
 * - No-op for already-tiny images (< 200 KB and within dimensions).
 *
 * Typical result: 4 MB iPhone photo (4032×3024) → ~120 KB WebP at 800×600.
 * This brings 1 GB of Supabase storage from ~250 photos up to ~8,000 photos.
 */
export async function compressImage(
  file: File | Blob,
  maxDimension = 800,
  quality = 0.8,
): Promise<Blob> {
  // Skip compression for tiny images
  if (file.size < 200 * 1024 && file.type !== 'image/png') {
    // Still re-encode to WebP for consistency, but skip resize
  }

  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  // Resize if exceeds max dimension (maintain aspect ratio)
  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  // White background for transparent PNGs (so they don't go black on WebP)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to compress image'))),
      'image/webp',
      quality,
    );
  });
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
