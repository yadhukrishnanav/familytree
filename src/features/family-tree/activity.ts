// Family Tree — Activity log helpers
// Writes & reads audit entries to/from the `activity_log` table.

import { getSupabase, isSupabaseConfigured } from './supabase';
import type { FamilyTreeState, Person, FamilyUnit, TimelineEvent, Action } from './types';

export type ActivityAction = 'insert' | 'update' | 'delete' | 'link' | 'unlink' | 'revert' | 'clear';
export type EntityType = 'person' | 'family_unit' | 'timeline_event' | 'family' | 'bulk';

export interface ActivityLogEntry {
  id: string;
  family_id: string;
  user_id: string | null;
  user_email: string | null;
  action: ActivityAction;
  entity_type: EntityType;
  entity_id: string;
  entity_name: string | null;
  before: any | null;
  after: any | null;
  created_at: string;
}

interface Actor {
  id: string;
  email: string;
}

function personName(p: Person | undefined): string {
  if (!p) return '(unknown)';
  return `${p.firstName} ${p.lastName ?? ''}`.trim();
}
function unitName(u: FamilyUnit, persons: Record<string, Person>): string {
  const p1 = persons[u.partner1Id];
  const p2 = u.partner2Id ? persons[u.partner2Id] : null;
  return p2 ? `${personName(p1)} ♥ ${personName(p2)}` : personName(p1);
}
function eventName(e: TimelineEvent): string {
  return `${e.title} (${e.year})`;
}

/**
 * Compute a list of activity entries that describe the effect of a dispatched action.
 * Returns [] for actions that don't merit logging (LOAD_STATE, UNDO/REDO handled separately).
 */
export function deriveActivityFromAction(
  action: Action,
  beforeState: FamilyTreeState,
  actor: Actor,
  familyId: string,
): Omit<ActivityLogEntry, 'id' | 'created_at' | 'family_id' | 'user_id' | 'user_email'>[] {
  const base = { user_id: undefined, user_email: undefined } as any;
  const out: Omit<ActivityLogEntry, 'id' | 'created_at' | 'family_id' | 'user_id' | 'user_email'>[] = [];

  switch (action.type) {
    case 'ADD_PERSON': {
      out.push({
        action: 'insert',
        entity_type: 'person',
        entity_id: action.person.id,
        entity_name: personName(action.person),
        before: null,
        after: action.person,
      });
      break;
    }
    case 'UPDATE_PERSON': {
      const prev = beforeState.persons[action.person.id];
      out.push({
        action: 'update',
        entity_type: 'person',
        entity_id: action.person.id,
        entity_name: personName(action.person),
        before: prev ?? null,
        after: action.person,
      });
      break;
    }
    case 'DELETE_PERSON': {
      const prev = beforeState.persons[action.personId];
      out.push({
        action: 'delete',
        entity_type: 'person',
        entity_id: action.personId,
        entity_name: prev ? personName(prev) : '(removed)',
        before: prev ?? null,
        after: null,
      });
      break;
    }
    case 'ADD_SPOUSE': {
      out.push({
        action: 'link',
        entity_type: 'family_unit',
        entity_id: action.unit.id,
        entity_name: unitName(action.unit, beforeState.persons),
        before: null,
        after: action.unit,
      });
      break;
    }
    case 'ADD_CHILD': {
      const parent = beforeState.persons[action.parentId];
      const child = beforeState.persons[action.childId];
      out.push({
        action: 'link',
        entity_type: 'family_unit',
        entity_id: `${action.parentId}->${action.childId}`,
        entity_name: `${parent ? personName(parent) : '?'} → ${child ? personName(child) : '?'}`,
        before: null,
        after: { parentId: action.parentId, childId: action.childId },
      });
      break;
    }
    case 'ADD_EVENT': {
      out.push({
        action: 'insert',
        entity_type: 'timeline_event',
        entity_id: action.event.id,
        entity_name: eventName(action.event),
        before: null,
        after: action.event,
      });
      break;
    }
    case 'UPDATE_EVENT': {
      const prev = beforeState.timelineEvents.find((e) => e.id === action.event.id);
      out.push({
        action: 'update',
        entity_type: 'timeline_event',
        entity_id: action.event.id,
        entity_name: eventName(action.event),
        before: prev ?? null,
        after: action.event,
      });
      break;
    }
    case 'DELETE_EVENT': {
      const prev = beforeState.timelineEvents.find((e) => e.id === action.eventId);
      out.push({
        action: 'delete',
        entity_type: 'timeline_event',
        entity_id: action.eventId,
        entity_name: prev ? eventName(prev) : '(removed)',
        before: prev ?? null,
        after: null,
      });
      break;
    }
    case 'CLEAR_ALL': {
      out.push({
        action: 'clear',
        entity_type: 'bulk',
        entity_id: 'all',
        entity_name: 'Entire tree',
        before: { personCount: Object.keys(beforeState.persons).length, eventCount: beforeState.timelineEvents.length },
        after: null,
      });
      break;
    }
    // LOAD_SAMPLE / MERGE_SAMPLE / LOAD_STATE / UNDO / REDO are not logged as user activity
    // (LOAD_STATE is used by realtime/undo/revert machinery — logging would create noise)
    default:
      break;
  }
  return out;
}

// ---- Demo-mode localStorage fallback ----
// In demo mode (no Supabase), activity is persisted to localStorage so the
// "Recent activity" panel still works for testing.
const DEMO_ACTIVITY_KEY = 'family-tree-demo-activity';

function loadDemoActivity(familyId: string): ActivityLogEntry[] {
  try {
    const all = JSON.parse(localStorage.getItem(DEMO_ACTIVITY_KEY) ?? '{}');
    return all[familyId] ?? [];
  } catch {
    return [];
  }
}

function saveDemoActivity(familyId: string, entries: ActivityLogEntry[]) {
  const all = (() => { try { return JSON.parse(localStorage.getItem(DEMO_ACTIVITY_KEY) ?? '{}'); } catch { return {}; } })();
  // Cap at 200 entries per family to avoid bloating localStorage
  all[familyId] = entries.slice(-200);
  try {
    localStorage.setItem(DEMO_ACTIVITY_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn('localStorage full, trimming activity log', e);
    all[familyId] = entries.slice(-50);
    localStorage.setItem(DEMO_ACTIVITY_KEY, JSON.stringify(all));
  }
}

// Demo-mode realtime: dispatch to all open tabs via BroadcastChannel
let demoBroadcastChannel: BroadcastChannel | null = null;
function getDemoChannel(familyId: string): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!demoBroadcastChannel) {
    demoBroadcastChannel = new BroadcastChannel(`family-tree-activity-${familyId}`);
  }
  return demoBroadcastChannel;
}

/**
 * Persist activity log entries to Supabase. In demo mode, writes to localStorage.
 */
export async function logActivity(
  familyId: string,
  actor: Actor,
  entries: Omit<ActivityLogEntry, 'id' | 'created_at' | 'family_id' | 'user_id' | 'user_email'>[],
): Promise<void> {
  if (entries.length === 0) return;

  // Demo mode: localStorage + BroadcastChannel for cross-tab realtime
  if (!isSupabaseConfigured) {
    const existing = loadDemoActivity(familyId);
    const newRows: ActivityLogEntry[] = entries.map((e) => ({
      id: crypto.randomUUID(),
      family_id: familyId,
      user_id: actor.id,
      user_email: actor.email,
      action: e.action,
      entity_type: e.entity_type,
      entity_id: e.entity_id,
      entity_name: e.entity_name,
      before: e.before,
      after: e.after,
      created_at: new Date().toISOString(),
    }));
    const updated = [...existing, ...newRows];
    saveDemoActivity(familyId, updated);
    // Broadcast to other tabs/windows
    const channel = getDemoChannel(familyId);
    if (channel) {
      for (const row of newRows) {
        channel.postMessage(row);
      }
    }
    return;
  }

  // Supabase mode
  const client = getSupabase()!;
  const rows = entries.map((e) => ({
    family_id: familyId,
    user_id: actor.id,
    user_email: actor.email,
    action: e.action,
    entity_type: e.entity_type,
    entity_id: e.entity_id,
    entity_name: e.entity_name,
    before: e.before,
    after: e.after,
  }));
  const { error } = await client.from('activity_log').insert(rows);
  if (error) console.warn('Activity log insert failed', error);
}

/**
 * Fetch the most recent N activity entries for a family.
 */
export async function fetchRecentActivity(
  familyId: string,
  limit = 30,
): Promise<ActivityLogEntry[]> {
  if (!isSupabaseConfigured) {
    // Demo mode: read from localStorage, newest first
    const all = loadDemoActivity(familyId);
    return all.slice(-limit).reverse();
  }
  const client = getSupabase()!;
  const { data, error } = await client
    .from('activity_log')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('fetchRecentActivity failed', error);
    return [];
  }
  return (data as ActivityLogEntry[]) ?? [];
}

/**
 * Fetch the edit history for a single entity (e.g., a person).
 */
export async function fetchEntityHistory(
  familyId: string,
  entityType: EntityType,
  entityId: string,
  limit = 30,
): Promise<ActivityLogEntry[]> {
  if (!isSupabaseConfigured) {
    const all = loadDemoActivity(familyId);
    return all
      .filter((e) => e.entity_type === entityType && e.entity_id === entityId)
      .slice(-limit)
      .reverse();
  }
  const client = getSupabase()!;
  const { data, error } = await client
    .from('activity_log')
    .select('*')
    .eq('family_id', familyId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('fetchEntityHistory failed', error);
    return [];
  }
  return (data as ActivityLogEntry[]) ?? [];
}

/**
 * Subscribe to new activity log entries (realtime).
 * In Supabase mode: postgres_changes subscription.
 * In demo mode: BroadcastChannel across same-origin tabs.
 */
export function subscribeToActivity(
  familyId: string,
  onNew: (entry: ActivityLogEntry) => void,
): (() => void) | null {
  if (!isSupabaseConfigured) {
    // Demo mode: listen to BroadcastChannel for cross-tab updates
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
    const channel = new BroadcastChannel(`family-tree-activity-${familyId}`);
    channel.onmessage = (e) => {
      const entry = e.data as ActivityLogEntry;
      if (entry) onNew(entry);
    };
    return () => {
      channel.close();
    };
  }
  const client = getSupabase()!;
  const channel = client
    .channel(`activity-${familyId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `family_id=eq.${familyId}` },
      (payload) => onNew(payload.new as ActivityLogEntry),
    )
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}

/**
 * Human-readable description of an entry, e.g.:
 *   "added person Raghavan Nair"
 *   "updated event Wedding (1995)"
 *   "deleted person Lakshmi Pillai"
 *   "linked Raghavan Nair → Meera Nair"
 */
export function describeActivity(entry: ActivityLogEntry): string {
  const name = entry.entity_name ?? 'unknown';
  switch (entry.action) {
    case 'insert':
      if (entry.entity_type === 'person') return `added person ${name}`;
      if (entry.entity_type === 'timeline_event') return `added event ${name}`;
      return `added ${entry.entity_type} ${name}`;
    case 'update':
      if (entry.entity_type === 'person') return `edited ${name}`;
      if (entry.entity_type === 'timeline_event') return `edited event ${name}`;
      return `edited ${entry.entity_type} ${name}`;
    case 'delete':
      if (entry.entity_type === 'person') return `deleted person ${name}`;
      if (entry.entity_type === 'timeline_event') return `deleted event ${name}`;
      return `deleted ${entry.entity_type} ${name}`;
    case 'link':
      return `linked ${name}`;
    case 'unlink':
      return `unlinked ${name}`;
    case 'revert':
      return `reverted a change on ${name}`;
    case 'clear':
      return 'cleared the entire tree';
    default:
      return `${entry.action} ${name}`;
  }
}

/**
 * Format a timestamp as "5m ago" / "2h ago" / "3d ago" / "2024-01-15"
 */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.floor((now - then) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
