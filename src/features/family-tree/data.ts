// Family Tree — Sample data for demo / seeding

import type { FamilyTreeState, Person, FamilyUnit, TimelineEvent } from './types';

// Avatar color palettes (gradient pairs)
export const MALE_PALETTES: [string, string][] = [
  ['#6366f1', '#8b5cf6'],
  ['#0ea5e9', '#2563eb'],
  ['#10b981', '#059669'],
  ['#f59e0b', '#d97706'],
  ['#ef4444', '#b91c1c'],
  ['#14b8a6', '#0891b2'],
  ['#8b5cf6', '#6d28d9'],
  ['#64748b', '#334155'],
];

export const FEMALE_PALETTES: [string, string][] = [
  ['#ec4899', '#db2777'],
  ['#f43f5e', '#e11d48'],
  ['#a855f7', '#9333ea'],
  ['#8b5cf6', '#7c3aed'],
  ['#06b6d4', '#0891b2'],
  ['#84cc16', '#65a30d'],
  ['#f97316', '#ea580c'],
  ['#eab308', '#ca8a04'],
];

export function pickAvatarColors(gender: string, seed: number): [string, string] {
  const palettes = gender === 'female' ? FEMALE_PALETTES : MALE_PALETTES;
  return palettes[seed % palettes.length];
}

// Helpers for sample data generation
function p(
  id: string,
  firstName: string,
  lastName: string,
  gender: 'male' | 'female',
  birthYear: number,
  deathYear: number | undefined,
  occupation: string,
  birthPlace: string,
  paletteIdx: number,
): Person {
  return {
    id,
    firstName,
    lastName,
    birthYear,
    deathYear,
    gender,
    avatarColors: pickAvatarColors(gender, paletteIdx),
    occupation,
    birthPlace,
  };
}

// Sample: The Sharma family — 3 generations
const persons: Record<string, Person> = {
  p1: p('p1', 'Rajesh', 'Sharma', 'male', 1940, 2010, 'Doctor', 'Delhi', 0),
  p2: p('p2', 'Sunita', 'Sharma', 'female', 1945, 2018, 'Teacher', 'Jaipur', 0),
  p3: p('p3', 'Vikram', 'Sharma', 'male', 1968, undefined, 'Engineer', 'Delhi', 1),
  p4: p('p4', 'Anita', 'Sharma', 'female', 1972, undefined, 'Architect', 'Mumbai', 1),
  p5: p('p5', 'Priya', 'Verma', 'female', 1970, undefined, 'Lawyer', 'Pune', 2),
  p6: p('p6', 'Rohan', 'Sharma', 'male', 1995, undefined, 'Software Dev', 'Delhi', 2),
  p7: p('p7', 'Kavya', 'Sharma', 'female', 1998, undefined, 'Designer', 'Delhi', 3),
  p8: p('p8', 'Arjun', 'Sharma', 'male', 2000, undefined, 'Student', 'Mumbai', 3),
  p9: p('p9', 'Neha', 'Patel', 'female', 1996, undefined, 'Doctor', 'Bangalore', 4),
  p10: p('p10', 'Meera', 'Sharma', 'female', 2022, undefined, '', 'Delhi', 4),
  p11: p('p11', 'Aarav', 'Sharma', 'male', 2024, undefined, '', 'Delhi', 4),
  p12: p('p12', 'Sanjay', 'Sharma', 'male', 1970, undefined, 'Businessman', 'Delhi', 5),
  p13: p('p13', 'Kavita', 'Sharma', 'female', 1975, undefined, 'Chef', 'Mumbai', 5),
  p14: p('p14', 'Diya', 'Sharma', 'female', 2005, undefined, 'Student', 'Delhi', 6),
  p15: p('p15', 'Karan', 'Sharma', 'male', 2008, undefined, 'Student', 'Delhi', 6),
};

const familyUnits: FamilyUnit[] = [
  // Gen 1: Rajesh ♥ Sunita → Vikram, Sanjay
  { id: 'u1', partner1Id: 'p1', partner2Id: 'p2', childrenIds: ['p3', 'p12'], marriageYear: 1965 },
  // Gen 2: Vikram ♥ Anita → Rohan, Kavya, Arjun
  { id: 'u2', partner1Id: 'p3', partner2Id: 'p4', childrenIds: ['p6', 'p7', 'p8'], marriageYear: 1993 },
  // Gen 2: Sanjay ♥ Kavita → Diya, Karan
  { id: 'u3', partner1Id: 'p12', partner2Id: 'p13', childrenIds: ['p14', 'p15'], marriageYear: 1998 },
  // Gen 3: Rohan ♥ Neha → Meera, Aarav
  { id: 'u4', partner1Id: 'p6', partner2Id: 'p9', childrenIds: ['p10', 'p11'], marriageYear: 2020 },
];

const timelineEvents: TimelineEvent[] = [
  // Auto events (matching the auto-event ID conventions)
  { id: 'auto_birth_p1', year: 1940, title: 'Rajesh born', personIds: ['p1'], icon: 'birth', color: '#10b981' },
  { id: 'auto_death_p1', year: 2010, title: 'Rajesh passed away', personIds: ['p1'], icon: 'death', color: '#64748b' },
  { id: 'auto_birth_p2', year: 1945, title: 'Sunita born', personIds: ['p2'], icon: 'birth', color: '#10b981' },
  { id: 'auto_death_p2', year: 2018, title: 'Sunita passed away', personIds: ['p2'], icon: 'death', color: '#64748b' },
  { id: 'auto_marriage_p1_p2', year: 1965, title: 'Rajesh ♥ Sunita married', personIds: ['p1', 'p2'], icon: 'marriage', color: '#ec4899' },
  { id: 'auto_marriage_p3_p4', year: 1993, title: 'Vikram ♥ Anita married', personIds: ['p3', 'p4'], icon: 'marriage', color: '#ec4899' },
  { id: 'auto_marriage_p6_p9', year: 2020, title: 'Rohan ♥ Neha married', personIds: ['p6', 'p9'], icon: 'marriage', color: '#ec4899' },
  // Manual events
  { id: 'e1', year: 1990, title: 'Vikram graduated IIT', description: 'B.Tech in Computer Science', personIds: ['p3'], icon: 'graduation', color: '#8b5cf6' },
  { id: 'e2', year: 2018, title: 'Rohan joined Google', description: 'Software Engineer at Google Bangalore', personIds: ['p6'], icon: 'job', color: '#f59e0b' },
  { id: 'e3', year: 2023, title: 'Family reunion in Goa', description: 'All 4 generations gathered', personIds: ['p3', 'p4', 'p6', 'p7', 'p8', 'p10'], icon: 'travel', color: '#06b6d4' },
];

export const SAMPLE_DATA: FamilyTreeState = {
  persons,
  familyUnits,
  timelineEvents,
};
