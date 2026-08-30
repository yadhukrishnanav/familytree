// Family Tree — Type Definitions

export type Gender = 'male' | 'female' | 'other';

export interface Person {
  id: string;
  firstName: string;
  lastName?: string;
  birthYear?: number;
  deathYear?: number;
  gender: Gender;
  avatarColors: [string, string];
  occupation?: string;
  birthPlace?: string;
  photoUrl?: string;
}

export interface FamilyUnit {
  id: string;
  partner1Id: string;
  partner2Id?: string;
  childrenIds: string[];
  marriageYear?: number;
}

/**
 * Sentinel UUID used as `partner1Id` for "sibling groups" — FamilyUnits that
 * have no parents, only siblings (stored in `childrenIds`).
 *
 * Why this exists: when a user adds person B as "Sibling of A" but A has no
 * parents in the tree yet, we still want A and B to render at the same
 * generation level and be visually linked. We create a sibling-group unit
 * (partner1Id = NIL_UUID, partner2Id = undefined, childrenIds = [A, B]) and
 * the layout renders the children side-by-side at the same Y, with no parent
 * nodes and no marriage line.
 *
 * Using the nil UUID instead of empty string keeps the value compatible with
 * the `family_units.partner1_id uuid not null` column in Postgres — no schema
 * migration required.
 */
export const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/** True if this unit is a sibling group (no parents, just siblings). */
export function isSiblingGroup(unit: FamilyUnit): boolean {
  return unit.partner1Id === NIL_UUID;
}

export type TimelineIcon =
  | 'birth'
  | 'death'
  | 'marriage'
  | 'graduation'
  | 'job'
  | 'move'
  | 'milestone'
  | 'travel'
  | 'custom';

export interface TimelineEvent {
  id: string;
  year: number;
  title: string;
  description?: string;
  photoUrl?: string;
  personIds: string[];
  icon: TimelineIcon;
  color: string;
}

export interface FamilyTreeState {
  persons: Record<string, Person>;
  familyUnits: FamilyUnit[];
  timelineEvents: TimelineEvent[];
}

export interface FamilyInfo {
  id: string;
  name: string;
  shareCode: string;
  role: 'admin' | 'owner' | 'editor';
  memberCount: number;
}

// Layout types
export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  type: 'person' | 'couple';
  personId?: string;
  partner1Id?: string;
  partner2Id?: string;
  marriageYear?: number;
  generation?: number; // 0 = top generation, increases downward
}

export interface LayoutConnection {
  type: 'marriage' | 'parent-child' | 'junction';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  viaX?: number;
  viaY?: number;
  marriageYear?: number;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  connections: LayoutConnection[];
  width: number;
  height: number;
}

// Store actions
export type Action =
  | { type: 'ADD_PERSON'; person: Person }
  | { type: 'UPDATE_PERSON'; person: Person }
  | { type: 'DELETE_PERSON'; personId: string }
  | { type: 'ADD_SPOUSE'; unit: FamilyUnit }
  | { type: 'ADD_CHILD'; parentId: string; childId: string }
  | { type: 'ADD_SIBLING'; targetId: string; siblingId: string }
  | { type: 'PARENT_SIBLING_GROUP'; newParentId: string; siblingGroupId: string }
  | { type: 'ADD_EVENT'; event: TimelineEvent }
  | { type: 'UPDATE_EVENT'; event: TimelineEvent }
  | { type: 'DELETE_EVENT'; eventId: string }
  | { type: 'LOAD_SAMPLE' }
  | { type: 'MERGE_SAMPLE' }
  | { type: 'CLEAR_ALL' }
  | { type: 'LOAD_STATE'; state: FamilyTreeState }
  | { type: 'UNDO' }
  | { type: 'REDO' };
