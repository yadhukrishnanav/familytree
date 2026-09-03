// Family Tree — Supabase sync helpers
// Converts between snake_case DB rows and camelCase frontend types.

import { getSupabase, isSupabaseConfigured } from './supabase';
import type {
  FamilyUnitRow,
  PersonRow,
  TimelineEventRow,
} from './supabase';
import type { FamilyTreeState, FamilyUnit, Person, TimelineEvent } from './types';

// ---- Row → Domain ----
export function rowToPerson(r: PersonRow): Person {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name ?? undefined,
    birthYear: r.birth_year ?? undefined,
    deathYear: r.death_year ?? undefined,
    gender: r.gender as Person['gender'],
    avatarColors: [r.avatar_colors[0] ?? '#6366f1', r.avatar_colors[1] ?? '#8b5cf6'],
    occupation: r.occupation ?? undefined,
    birthPlace: r.birth_place ?? undefined,
    photoUrl: r.photo_url ?? undefined,
  };
}

export function rowToUnit(r: FamilyUnitRow): FamilyUnit {
  return {
    id: r.id,
    partner1Id: r.partner1_id,
    partner2Id: r.partner2_id ?? undefined,
    childrenIds: r.children_ids ?? [],
    marriageYear: r.marriage_year ?? undefined,
  };
}

function rowToEvent(r: TimelineEventRow): TimelineEvent {
  return {
    id: r.id,
    year: r.year,
    title: r.title,
    description: r.description ?? undefined,
    photoUrl: r.photo_url ?? undefined,
    personIds: r.person_ids ?? [],
    icon: r.icon as TimelineEvent['icon'],
    color: r.color,
  };
}

// ---- Domain → Row ----
function personToRow(p: Person, familyId: string): Omit<PersonRow, 'family_id'> {
  return {
    id: p.id,
    first_name: p.firstName,
    last_name: p.lastName ?? null,
    birth_year: p.birthYear ?? null,
    death_year: p.deathYear ?? null,
    gender: p.gender,
    avatar_colors: [p.avatarColors[0], p.avatarColors[1]],
    occupation: p.occupation ?? null,
    birth_place: p.birthPlace ?? null,
    photo_url: p.photoUrl ?? null,
  };
}

function unitToRow(u: FamilyUnit, familyId: string): Omit<FamilyUnitRow, 'family_id'> {
  return {
    id: u.id,
    partner1_id: u.partner1Id,
    partner2_id: u.partner2Id ?? null,
    children_ids: u.childrenIds,
    marriage_year: u.marriageYear ?? null,
  };
}

function eventToRow(e: TimelineEvent, familyId: string): Omit<TimelineEventRow, 'family_id'> {
  return {
    id: e.id,
    year: e.year,
    title: e.title,
    description: e.description ?? null,
    photo_url: e.photoUrl ?? null,
    person_ids: e.personIds,
    icon: e.icon,
    color: e.color,
  };
}

// ---- Load entire tree from Supabase ----
export async function loadTreeFromSupabase(
  familyId: string,
): Promise<FamilyTreeState> {
  if (!isSupabaseConfigured) {
    return { persons: {}, familyUnits: [], timelineEvents: [] };
  }
  const client = getSupabase()!;

  const [personsRes, unitsRes, eventsRes] = await Promise.all([
    client.from('persons').select('*').eq('family_id', familyId),
    client.from('family_units').select('*').eq('family_id', familyId),
    client.from('timeline_events').select('*').eq('family_id', familyId),
  ]);

  if (personsRes.error) throw personsRes.error;
  if (unitsRes.error) throw unitsRes.error;
  if (eventsRes.error) throw eventsRes.error;

  const persons: Record<string, Person> = {};
  for (const row of (personsRes.data as PersonRow[]) ?? []) {
    persons[row.id] = rowToPerson(row);
  }

  const familyUnits: FamilyUnit[] = ((unitsRes.data as FamilyUnitRow[]) ?? []).map(rowToUnit);
  const timelineEvents: TimelineEvent[] = ((eventsRes.data as TimelineEventRow[]) ?? []).map(rowToEvent);

  return { persons, familyUnits, timelineEvents };
}

// ---- Persist entire tree to Supabase (upsert + soft diff) ----
// Strategy: upsert all persons/units/events; delete rows that no longer exist.
export async function saveTreeToSupabase(
  familyId: string,
  state: FamilyTreeState,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const client = getSupabase()!;

  // Persons
  const existingPersonsRes = await client
    .from('persons')
    .select('id')
    .eq('family_id', familyId);
  if (existingPersonsRes.error) throw existingPersonsRes.error;
  const existingPersonIds = new Set((existingPersonsRes.data as { id: string }[])?.map((r) => r.id) ?? []);
  const newPersonIds = new Set(Object.keys(state.persons));

  const personsToUpsert = Object.values(state.persons).map((p) => ({
    ...personToRow(p, familyId),
    family_id: familyId,
  }));
  if (personsToUpsert.length > 0) {
    const { error } = await client.from('persons').upsert(personsToUpsert, { onConflict: 'id' });
    if (error) throw error;
  }
  const personsToDelete = [...existingPersonIds].filter((id) => !newPersonIds.has(id));
  if (personsToDelete.length > 0) {
    const { error } = await client.from('persons').delete().in('id', personsToDelete);
    if (error) throw error;
  }

  // Family units
  const existingUnitsRes = await client
    .from('family_units')
    .select('id')
    .eq('family_id', familyId);
  if (existingUnitsRes.error) throw existingUnitsRes.error;
  const existingUnitIds = new Set((existingUnitsRes.data as { id: string }[])?.map((r) => r.id) ?? []);
  const newUnitIds = new Set(state.familyUnits.map((u) => u.id));

  const unitsToUpsert = state.familyUnits.map((u) => ({
    ...unitToRow(u, familyId),
    family_id: familyId,
  }));
  if (unitsToUpsert.length > 0) {
    const { error } = await client.from('family_units').upsert(unitsToUpsert, { onConflict: 'id' });
    if (error) throw error;
  }
  const unitsToDelete = [...existingUnitIds].filter((id) => !newUnitIds.has(id));
  if (unitsToDelete.length > 0) {
    const { error } = await client.from('family_units').delete().in('id', unitsToDelete);
    if (error) throw error;
  }

  // Timeline events — skip auto events (id starts with 'auto_').
  // Auto events (auto_birth_X, auto_death_X, auto_marriage_X_Y) are DERIVED from
  // person/family-unit data. The timeline_events table's `id` column is `uuid`,
  // so string IDs like 'auto_birth_abc123' are rejected by Postgres on upsert.
  // We persist only manually-created events here; auto events are regenerated
  // client-side from person data after load (see store.tsx → regenerateAutoEvents).
  const manualEvents = state.timelineEvents.filter((e) => !e.id.startsWith('auto_'));
  const existingEventsRes = await client
    .from('timeline_events')
    .select('id')
    .eq('family_id', familyId);
  if (existingEventsRes.error) throw existingEventsRes.error;
  const existingEventIds = new Set((existingEventsRes.data as { id: string }[])?.map((r) => r.id) ?? []);
  const newEventIds = new Set(manualEvents.map((e) => e.id));

  const eventsToUpsert = manualEvents.map((e) => ({
    ...eventToRow(e, familyId),
    family_id: familyId,
  }));
  if (eventsToUpsert.length > 0) {
    const { error } = await client.from('timeline_events').upsert(eventsToUpsert, { onConflict: 'id' });
    if (error) throw error;
  }
  const eventsToDelete = [...existingEventIds].filter((id) => !newEventIds.has(id));
  if (eventsToDelete.length > 0) {
    const { error } = await client.from('timeline_events').delete().in('id', eventsToDelete);
    if (error) throw error;
  }
}

// ---- Realtime subscription helpers ----
export type RealtimeChange =
  | { table: 'persons'; eventType: 'INSERT' | 'UPDATE'; row: PersonRow }
  | { table: 'persons'; eventType: 'DELETE'; row: { id: string } }
  | { table: 'family_units'; eventType: 'INSERT' | 'UPDATE'; row: FamilyUnitRow }
  | { table: 'family_units'; eventType: 'DELETE'; row: { id: string } }
  | { table: 'timeline_events'; eventType: 'INSERT' | 'UPDATE'; row: TimelineEventRow }
  | { table: 'timeline_events'; eventType: 'DELETE'; row: { id: string } };

export function subscribeToTreeChanges(
  familyId: string,
  onChange: (change: RealtimeChange) => void,
): (() => void) | null {
  if (!isSupabaseConfigured) return null;
  const client = getSupabase()!;
  const channel = client
    .channel(`family-${familyId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'persons', filter: `family_id=eq.${familyId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          onChange({ table: 'persons', eventType: 'DELETE', row: payload.old as { id: string } });
        } else {
          onChange({ table: 'persons', eventType: payload.eventType as 'INSERT' | 'UPDATE', row: payload.new as PersonRow });
        }
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'family_units', filter: `family_id=eq.${familyId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          onChange({ table: 'family_units', eventType: 'DELETE', row: payload.old as { id: string } });
        } else {
          onChange({ table: 'family_units', eventType: payload.eventType as 'INSERT' | 'UPDATE', row: payload.new as FamilyUnitRow });
        }
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'timeline_events', filter: `family_id=eq.${familyId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          onChange({ table: 'timeline_events', eventType: 'DELETE', row: payload.old as { id: string } });
        } else {
          onChange({ table: 'timeline_events', eventType: payload.eventType as 'INSERT' | 'UPDATE', row: payload.new as TimelineEventRow });
        }
      },
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

// Apply a single realtime change to local state
export function applyRealtimeChange(
  state: FamilyTreeState,
  change: RealtimeChange,
): FamilyTreeState {
  switch (change.table) {
    case 'persons': {
      if (change.eventType === 'DELETE') {
        const persons = { ...state.persons };
        delete persons[change.row.id];
        return { ...state, persons };
      }
      const person = rowToPerson(change.row);
      return { ...state, persons: { ...state.persons, [person.id]: person } };
    }
    case 'family_units': {
      if (change.eventType === 'DELETE') {
        return {
          ...state,
          familyUnits: state.familyUnits.filter((u) => u.id !== change.row.id),
        };
      }
      const unit = rowToUnit(change.row);
      const exists = state.familyUnits.some((u) => u.id === unit.id);
      const familyUnits = exists
        ? state.familyUnits.map((u) => (u.id === unit.id ? unit : u))
        : [...state.familyUnits, unit];
      return { ...state, familyUnits };
    }
    case 'timeline_events': {
      if (change.eventType === 'DELETE') {
        return {
          ...state,
          timelineEvents: state.timelineEvents.filter((e) => e.id !== change.row.id),
        };
      }
      const event = rowToEvent(change.row);
      const exists = state.timelineEvents.some((e) => e.id === event.id);
      const timelineEvents = exists
        ? state.timelineEvents.map((e) => (e.id === event.id ? event : e))
        : [...state.timelineEvents, event];
      return { ...state, timelineEvents };
    }
  }
}
