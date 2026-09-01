// Family Tree — Shared constants
// Single source of truth for all hardcoded values: brand colors, avatar
// palettes, layout dimensions, timing intervals, etc.
//
// WHY THIS EXISTS:
// Previously, colors like '#10b981', '#14b8a6', '#ec4899' were scattered as
// string literals across 15+ files. When the user asked to "remove green
// accents", we had to hunt through every file. Now everything lives here.
//
// HOW TO USE:
//   import { BRAND, AVATAR_PALETTES, LAYOUT } from '../constants';
//   const color = BRAND.PRIMARY;        // '#10b981'
//   const gap = LAYOUT.GENERATION_GAP;   // 160

// ---- Brand colors ----
// The family's visual identity. Emerald + teal = growth, family, roots.
// Pink/rose = marriage, love. Slate = neutral structure.
export const BRAND = {
  PRIMARY: '#10b981',        // emerald-500 — primary actions, brand
  PRIMARY_DARK: '#059669',   // emerald-600 — hover states
  SECONDARY: '#14b8a6',     // teal-500 — gradients pair with primary
  SECONDARY_DARK: '#0d9488', // teal-600 — hover states
  ACCENT_PINK: '#ec4899',   // pink-500 — marriage, heart icon
  ACCENT_ROSE: '#f43f5e',   // rose-500 — marriage gradients
  // Neutrals (slate scale)
  SLATE_50: '#f8fafc',
  SLATE_100: '#f1f5f9',
  SLATE_200: '#e2e8f0',
  SLATE_300: '#cbd5e1',
  SLATE_400: '#94a3b8',
  SLATE_500: '#64748b',
  SLATE_600: '#475569',
  SLATE_700: '#334155',
  SLATE_800: '#1e293b',
  SLATE_900: '#0f172a',
  // Semantic
  DECEASED: '#64748b',       // slate-500 — deceased person accent
  DECEASED_BG: 'rgba(100, 116, 139, 0.14)',
  LIVING_BG: 'rgba(148, 163, 184, 0.18)',
  // Gender dots
  GENDER_FEMALE: '#ec4899',  // pink
  GENDER_MALE: '#3b82f6',    // blue
  GENDER_OTHER: '#a855f7',   // purple
} as const;

// ---- Canvas (pan/zoom) limits ----
export const CANVAS = {
  MIN_SCALE: 0.2,
  MAX_SCALE: 3,
  DEFAULT_TRANSFORM: { x: 100, y: 60, scale: 0.8 },
  ZOOM_STEP: 1.2, // multiply/divide scale by this on each zoom button press
  WHEEL_SENSITIVITY: 600, // divide deltaY by this for wheel zoom
} as const;

// ---- Avatar color palettes ----
// Used by pickAvatarColors() in data.ts. Gradient pairs for person avatars.
// Indexed by gender + seed for deterministic-but-varied colors.
export const MALE_PALETTES: [string, string][] = [
  ['#6366f1', '#8b5cf6'], // indigo → violet
  ['#0ea5e9', '#2563eb'], // sky → blue
  ['#10b981', '#059669'], // emerald → emerald-dark
  ['#f59e0b', '#d97706'], // amber → amber-dark
  ['#ef4444', '#b91c1c'], // red → red-dark
  ['#14b8a6', '#0891b2'], // teal → cyan
  ['#8b5cf6', '#6d28d9'], // violet → violet-dark
  ['#64748b', '#334155'], // slate → slate-dark
];

export const FEMALE_PALETTES: [string, string][] = [
  ['#ec4899', '#db2777'], // pink → pink-dark
  ['#f43f5e', '#e11d48'], // rose → rose-dark
  ['#a855f7', '#9333ea'], // purple → purple-dark
  ['#8b5cf6', '#7c3aed'], // violet → violet-dark
  ['#06b6d4', '#0891b2'], // cyan → cyan-dark
  ['#84cc16', '#65a30d'], // lime → lime-dark
  ['#f97316', '#ea580c'], // orange → orange-dark
  ['#eab308', '#ca8a04'], // yellow → yellow-dark
];

// ---- Layout dimensions (pixels) ----
// Used by layout.ts + PersonCard.tsx. Changing these rescales the tree.
export const LAYOUT = {
  NODE_WIDTH: 220,
  NODE_HEIGHT: 110,
  SPOUSE_GAP: 40,      // horizontal gap between partners in a couple
  SIBLING_GAP: 50,     // horizontal gap between sibling subtrees
  GENERATION_GAP: 160, // vertical gap between generations
} as const;

// ---- Timing (milliseconds) ----
export const TIMING = {
  SUPABASE_SYNC_DEBOUNCE: 800,    // debounce before writing to Supabase
  QUICKACCESS_AUTH_PROPAGATION: 500, // wait for auth state to propagate
  NOMINATIM_RATE_LIMIT: 1100,     // Nominatim usage policy: max 1 req/sec
  GEOLOCATION_TIMEOUT: 8000,      // geolocation API timeout
  GEOLOCATION_MAX_AGE: 600000,    // accept cached position up to 10 min old
  TOAST_COPY_RESET: 1800,         // how long "copied!" feedback stays
  INVALIDATE_SIZE_DELAY: 250,     // Leaflet invalidateSize delay (after CSS transition)
  CELEBRATION_AUTO_DISMISS: 10000, // wedding overlay auto-dismiss
} as const;

// ---- Wedding details ----
// The app is built around Anu's wedding. These are the event details shown
// in the celebration overlay.
export const WEDDING = {
  DATE: '2026-09-05T00:00:00', // ISO — overlay shows until this date
  DATE_DISPLAY: '31st August 2026',
  VENUE: 'Wasava Cliff House, Kannur',
  COUPLE: "Anu's Wedding",
} as const;

// ---- Sentinel UUID for sibling groups ----
// Used as partner1Id in FamilyUnits that represent sibling groups (no parents).
// See types.ts for the full explanation.
export const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/** True if this unit is a sibling group (no parents, just siblings). */
export function isSiblingGroup<T extends { partner1Id: string }>(unit: T): boolean {
  return unit.partner1Id === NIL_UUID;
}

// ---- localStorage keys ----
// All keys prefixed with 'familytree.' to avoid collisions.
export const STORAGE_KEYS = {
  GEOCODE_CACHE: 'familytree.geocode.cache.v1',
  LANDING_LOCATION: 'familytree.landing.location.v1',
  DEMO_USERS: 'family-tree-demo-users',
  DEMO_SESSION: 'family-tree-demo-session',
  DEMO_FAMILIES: 'family-tree-demo-families',
  DEMO_MEMBERS: 'family-tree-demo-members',
  TREE_DATA_PREFIX: 'family-tree-data-', // + familyId
} as const;

// ---- External service URLs ----
export const EXTERNAL = {
  NOMINATIM_SEARCH: 'https://nominatim.openstreetmap.org/search',
  NOMINATIM_REVERSE: 'https://nominatim.openstreetmap.org/reverse',
  OSM_TILES: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
} as const;

// Leaflet marker icon CDN URLs (webpack mangles local imports, so we use CDN)
export const LEAFLET_MARKER_ICON_URLS = {
  ICON: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  ICON_2X: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  SHADOW: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
} as const;

// ---- Default map center (Kerala, India) ----
export const DEFAULT_MAP_CENTER: [number, number] = [11.8744, 75.3704];
export const DEFAULT_MAP_ZOOM = 6;
