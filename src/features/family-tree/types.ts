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
  role: 'owner' | 'editor';
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
  | { type: 'ADD_EVENT'; event: TimelineEvent }
  | { type: 'UPDATE_EVENT'; event: TimelineEvent }
  | { type: 'DELETE_EVENT'; eventId: string }
  | { type: 'LOAD_SAMPLE' }
  | { type: 'MERGE_SAMPLE' }
  | { type: 'CLEAR_ALL' }
  | { type: 'LOAD_STATE'; state: FamilyTreeState }
  | { type: 'UNDO' }
  | { type: 'REDO' };
