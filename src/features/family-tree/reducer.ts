// Family Tree — State reducer (pure functions)
// Handles ADD/UPDATE/DELETE for persons, units, events, plus undo/redo and sample/clear.

import type { Action, FamilyTreeState, FamilyUnit, Person, TimelineEvent } from './types';
import { NIL_UUID } from './types';
import { SAMPLE_DATA } from './data';

export const initialState: FamilyTreeState = {
  persons: {},
  familyUnits: [],
  timelineEvents: [],
};

// Deterministic IDs for auto-generated events
const AUTO_BIRTH = (id: string) => `auto_birth_${id}`;
const AUTO_DEATH = (id: string) => `auto_death_${id}`;
const AUTO_MARRIAGE = (a: string, b: string) =>
  `auto_marriage_${[a, b].sort().join('_')}`;

function sortedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function upsertAutoEvent(
  events: TimelineEvent[],
  event: TimelineEvent,
): TimelineEvent[] {
  const idx = events.findIndex((e) => e.id === event.id);
  if (idx === -1) return [...events, event];
  // Preserve user-edited description & photo
  const existing = events[idx];
  const merged: TimelineEvent = {
    ...event,
    description: existing.description ?? event.description,
    photoUrl: existing.photoUrl ?? event.photoUrl,
  };
  const next = [...events];
  next[idx] = merged;
  return next;
}

function syncPersonAutoEvents(
  events: TimelineEvent[],
  person: Person,
): TimelineEvent[] {
  let next = [...events];

  // Birth
  if (person.birthYear != null) {
    next = upsertAutoEvent(next, {
      id: AUTO_BIRTH(person.id),
      year: person.birthYear,
      title: `${person.firstName} ${person.lastName ?? ''}`.trim() + ' born',
      personIds: [person.id],
      icon: 'birth',
      color: '#10b981',
    });
  } else {
    next = next.filter((e) => e.id !== AUTO_BIRTH(person.id));
  }

  // Death
  if (person.deathYear != null) {
    next = upsertAutoEvent(next, {
      id: AUTO_DEATH(person.id),
      year: person.deathYear,
      title:
        `${person.firstName} ${person.lastName ?? ''}`.trim() + ' passed away',
      personIds: [person.id],
      icon: 'death',
      color: '#64748b',
    });
  } else {
    next = next.filter((e) => e.id !== AUTO_DEATH(person.id));
  }

  return next;
}

function syncMarriageAutoEvent(
  events: TimelineEvent[],
  p1: Person,
  p2: Person,
  marriageYear: number,
): TimelineEvent[] {
  const id = AUTO_MARRIAGE(p1.id, p2.id);
  return upsertAutoEvent(events, {
    id,
    year: marriageYear,
    title: `${p1.firstName} ♥ ${p2.firstName} married`,
    personIds: [p1.id, p2.id],
    icon: 'marriage',
    color: '#ec4899',
  });
}

export function reducer(state: FamilyTreeState, action: Action): FamilyTreeState {
  switch (action.type) {
    case 'ADD_PERSON': {
      const persons = { ...state.persons, [action.person.id]: action.person };
      const timelineEvents = syncPersonAutoEvents(
        state.timelineEvents,
        action.person,
      );
      return { ...state, persons, timelineEvents };
    }
    case 'UPDATE_PERSON': {
      const persons = { ...state.persons, [action.person.id]: action.person };
      const timelineEvents = syncPersonAutoEvents(
        state.timelineEvents,
        action.person,
      );
      return { ...state, persons, timelineEvents };
    }
    case 'DELETE_PERSON': {
      const persons = { ...state.persons };
      delete persons[action.personId];

      // Remove from family units (as partner or child)
      const familyUnits: FamilyUnit[] = [];
      for (const u of state.familyUnits) {
        if (u.partner1Id === action.personId && !u.partner2Id) continue; // unit dissolves
        if (u.partner1Id === action.personId && u.partner2Id) {
          familyUnits.push({
            ...u,
            partner1Id: u.partner2Id,
            partner2Id: undefined,
            childrenIds: u.childrenIds.filter((c) => c !== action.personId),
          });
          continue;
        }
        if (u.partner2Id === action.personId) {
          familyUnits.push({
            ...u,
            partner2Id: undefined,
            childrenIds: u.childrenIds.filter((c) => c !== action.personId),
          });
          continue;
        }
        familyUnits.push({
          ...u,
          childrenIds: u.childrenIds.filter((c) => c !== action.personId),
        });
      }

      // Dissolve sibling groups (partner1Id === NIL_UUID) that no longer have
      // at least 2 siblings. A single "sibling" isn't a group — drop the unit
      // entirely so the remaining person falls back to standalone rendering.
      const prunedFamilyUnits = familyUnits.filter((u) => {
        if (u.partner1Id !== NIL_UUID) return true; // regular unit — keep
        return u.childrenIds.length >= 2; // sibling group — keep only if 2+ siblings
      });

      // Remove auto events for this person + remove from manual event personIds
      const timelineEvents = state.timelineEvents
        .filter((e) => {
          if (e.id === AUTO_BIRTH(action.personId)) return false;
          if (e.id === AUTO_DEATH(action.personId)) return false;
          // Marriage events where this person is a partner
          for (const u of state.familyUnits) {
            if (
              (u.partner1Id === action.personId || u.partner2Id === action.personId) &&
              u.partner1Id && u.partner2Id
            ) {
              const [a, b] = sortedPair(u.partner1Id, u.partner2Id!);
              if (e.id === `auto_marriage_${a}_${b}`) return false;
            }
          }
          return true;
        })
        .map((e) => ({
          ...e,
          personIds: e.personIds.filter((id) => id !== action.personId),
        }))
        .filter((e) => e.personIds.length > 0 || !e.id.startsWith('auto_'));

      return { ...state, persons, familyUnits: prunedFamilyUnits, timelineEvents };
    }
    case 'ADD_SPOUSE': {
      const familyUnits = [...state.familyUnits, action.unit];
      let timelineEvents = state.timelineEvents;
      if (action.unit.partner2Id && action.unit.marriageYear != null) {
        const p1 = state.persons[action.unit.partner1Id];
        const p2 = state.persons[action.unit.partner2Id];
        if (p1 && p2) {
          timelineEvents = syncMarriageAutoEvent(
            timelineEvents,
            p1,
            p2,
            action.unit.marriageYear,
          );
        }
      }
      return { ...state, familyUnits, timelineEvents };
    }
    case 'ADD_CHILD': {
      // Attach childId to the unit where parentId is a partner
      const familyUnits = state.familyUnits.map((u) => {
        const isParent =
          u.partner1Id === action.parentId ||
          u.partner2Id === action.parentId;
        if (!isParent) return u;
        if (u.childrenIds.includes(action.childId)) return u;
        return { ...u, childrenIds: [...u.childrenIds, action.childId] };
      });
      return { ...state, familyUnits };
    }
    case 'ADD_SIBLING': {
      // Attach siblingId to whichever unit already has targetId in its childrenIds.
      // This covers two cases:
      //   1. Target has a real parent unit (normal parents) → sibling joins as
      //      another child of those parents.
      //   2. Target is in a "sibling group" (partner1Id === NIL_UUID) → sibling
      //      joins that group.
      // If neither applies (target is standalone, no unit at all), create a
      // NEW sibling group containing both target and sibling. This keeps them
      // at the same generation level even when their parents haven't been
      // added yet — the user's explicit request.
      let attached = false;
      const familyUnits = state.familyUnits.map((u) => {
        if (!u.childrenIds.includes(action.targetId)) return u;
        if (u.childrenIds.includes(action.siblingId)) {
          attached = true;
          return u;
        }
        attached = true;
        return { ...u, childrenIds: [...u.childrenIds, action.siblingId] };
      });
      if (!attached) {
        // No existing parent unit AND no existing sibling group for target.
        // Create a new sibling group containing both target and sibling.
        // partner1Id = NIL_UUID signals "no parents" to the layout.
        const newGroup: FamilyUnit = {
          id: crypto.randomUUID(),
          partner1Id: NIL_UUID,
          partner2Id: undefined,
          childrenIds: [action.targetId, action.siblingId],
        };
        return { ...state, familyUnits: [...state.familyUnits, newGroup] };
      }
      return { ...state, familyUnits };
    }
    case 'PARENT_SIBLING_GROUP': {
      // User added a parent to someone who was in a sibling group. Promote
      // ALL the siblings to children of the new parent, and dissolve the
      // sibling group. This prevents the siblings from being rendered
      // twice (once in the sibling group, once under the new parent).
      const siblingGroup = state.familyUnits.find((u) => u.id === action.siblingGroupId);
      if (!siblingGroup || siblingGroup.partner1Id !== NIL_UUID) {
        return state; // not a sibling group — no-op
      }
      const newUnit: FamilyUnit = {
        id: crypto.randomUUID(),
        partner1Id: action.newParentId,
        partner2Id: undefined,
        childrenIds: [...siblingGroup.childrenIds],
      };
      const familyUnits = state.familyUnits
        .filter((u) => u.id !== action.siblingGroupId)
        .concat(newUnit);
      return { ...state, familyUnits };
    }
    case 'ADD_EVENT': {
      return {
        ...state,
        timelineEvents: [...state.timelineEvents, action.event],
      };
    }
    case 'UPDATE_EVENT': {
      return {
        ...state,
        timelineEvents: state.timelineEvents.map((e) =>
          e.id === action.event.id ? action.event : e,
        ),
      };
    }
    case 'DELETE_EVENT': {
      return {
        ...state,
        timelineEvents: state.timelineEvents.filter(
          (e) => e.id !== action.eventId,
        ),
      };
    }
    case 'LOAD_SAMPLE':
      return SAMPLE_DATA;
    case 'MERGE_SAMPLE': {
      const persons = { ...state.persons };
      for (const [id, p] of Object.entries(SAMPLE_DATA.persons)) {
        if (!persons[id]) persons[id] = p;
      }
      const existingUnitIds = new Set(state.familyUnits.map((u) => u.id));
      const familyUnits = [
        ...state.familyUnits,
        ...SAMPLE_DATA.familyUnits.filter((u) => !existingUnitIds.has(u.id)),
      ];
      const existingEventIds = new Set(state.timelineEvents.map((e) => e.id));
      const timelineEvents = [
        ...state.timelineEvents,
        ...SAMPLE_DATA.timelineEvents.filter((e) => !existingEventIds.has(e.id)),
      ];
      return { persons, familyUnits, timelineEvents };
    }
    case 'CLEAR_ALL':
      return { persons: {}, familyUnits: [], timelineEvents: [] };
    case 'LOAD_STATE':
      return action.state;
    case 'UNDO':
    case 'REDO':
      // Handled by the StoreProvider wrapper, not the reducer body
      return state;
    default:
      return state;
  }
}

export { AUTO_BIRTH, AUTO_DEATH, AUTO_MARRIAGE, sortedPair, syncPersonAutoEvents, syncMarriageAutoEvent };
