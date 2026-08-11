# Family Tree — Project Handover Document

## Overview

Interactive family tree builder with real-time collaboration. Users create family accounts, build trees with person nodes and relationship connections, upload photos, track timeline events, and export to PDF/PNG. Deployed via Supabase (auth + database + storage + realtime) + Vercel (hosting).

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React + Vite | React 19, Vite 7 |
| Styling | Tailwind CSS v4 | 4.1.17 |
| Language | TypeScript | 5.9.3 |
| Backend | Supabase | @supabase/supabase-js ^2.109 |
| Export | html2canvas + jsPDF | 1.4.1 / 4.2.1 |
| Build | vite-plugin-singlefile | Inlines JS/CSS into single HTML |

---

## File Map

```
src/
├── App.tsx                          # Root: AuthProvider → AppContent → (AuthPage | StoreProvider → MainApp)
├── main.tsx                         # Vite entry (render App)
├── index.css                        # Tailwind import + modal animation keyframe
├── vite-env.d.ts                    # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY types
│
├── types.ts                         # All TypeScript interfaces
├── auth.tsx                         # Supabase Auth context (AuthProvider, useAuth)
├── store.tsx                        # Family tree state reducer (StoreProvider, useStore)
├── data.ts                          # SAMPLE_DATA for demo/seed (15 persons, 4 units, 10 events)
├── layout.ts                        # Auto-layout algorithm + NODE_WIDTH/HEIGHT constants
│
├── lib/
│   └── supabase.ts                  # Supabase client init + DB type interfaces + photo upload helpers
│
├── utils/
│   ├── export.ts                    # exportToImage(), exportToPDF(), exportTimelineToImage()
│   └── cn.ts                        # clsx + tailwind-merge utility (unused but available)
│
└── components/
    ├── AuthPage.tsx                 # Full auth UI: sign-in, sign-up, family select, create, join
    ├── FamilyTree.tsx               # Main tree canvas + pan/zoom + toolbar + modals + detail panel + export' + timeline
    ├── PersonCard.tsx               # Single person node card (avatar, name, dates, gender badge)
    ├── PersonForm.tsx               # Add/Edit person form with photo upload
    ├──+ RelationshipForm.tsx         # Link two people as spouse (with marriage year) or parent→child
    ├── EventForm.tsx                # Add/Edit timeline event form with photo, icon, color, related people
    ├── Timeline.tsx                 # Horizontal zoomable timeline strip at bottom
    └── Modal.tsx                    # Reusable modal wrapper with animation

supabase/
└── schema.sql                       # Full DB schema: tables, RLS policies, triggers, storage bucket, realtime

.env.example                         # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
DEPLOYMENT.md                        # 8-step deployment guide (Supabase → GitHub → Vercel)
```

---

## Data Model

### Frontend Types (`src/types.ts`)

```
Person { id, firstName, lastName?, birthYear?, deathYear?, gender, avatarColors, occupation?, birthPlace?, photoUrl? }
FamilyUnit { id, partner1Id, partner2Id?, childrenIds[] }
TimelineEvent { id, year, title, description?, photoUrl?, personIds[], icon, color }
FamilyTreeState { persons: Record<string, Person>, familyUnits: FamilyUnit[], timelineEvents: TimelineEvent[] }
FamilyInfo { id, name, shareCode, role, memberCount }  (from auth context)
```

### Supabase Tables (`supabase/schema.sql`)

```
families        (id UUID PK, name TEXT, share_code TEXT UNIQUE, created_at)
family_members  (user_id → auth.users, family_id → families, role 'owner'|'editor')
persons         (family_id FK, first_name, last_name, birth_year, death_year, gender, avatar_colors TEXT[], occupation, birth_place, photo_url)
family_units    (family_id FK, partner1_id, partner2_id, children_ids UUID[])
timeline_events (family_id FK, year, title, description, photo_url, person_ids UUID[], icon, color)
storage bucket: photos (public read, authenticated write)
```

All tables have **Row Level Security** via `is_family_member(fam_id)` helper function. A **trigger** auto-adds the family creator as `owner` in `family_members`.

---

## Architecture & Data Flow

### Auth Flow
```
Browser → AuthPage (sign-up/sign-in)
       → Supabase Auth (email/password)
       → auth.tsx loads user's families from family_members table
       → User selects or creates family → activeFamily set
       → StoreProvider initialized with familyId
```

### Tree Data Flow
```
User Action → dispatch(Action) → reducer() → new state
           → useEffect saves to localStorage (offline fallback)
           → TODO: sync to Supabase tables (currently localStorage-only for tree data)
```

**⚠️ Current gap**: Tree CRUD operations (persons, familyUnits, timelineEvents) use `useReducer` with localStorage persistence. Supabase client is configured but tree data sync to/from Supabase is **not yet wired**. The auth and family management use Supabase; the tree data still uses localStorage keyed by `family-tree-data-{familyId}`. **Next agent should implement Supabase sync for tree data.**

### Layout Algorithm (`src/layout.ts`)
```
computeLayout(persons, familyUnits) → LayoutResult { nodes[], connections[], width, height }

Algorithm:
1. Find root units (units where neither partner is a child elsewhere)
2. For each root, computeSubtreeWidth() bottom-up (max of couple width and children total width)
3. positionUnit() top-down: center parents above children, draw marriage lines (♥) and parent-child junction bars
4. Isolated persons (not in any unit) placed in a row below
```

### Auto-Event System (`src/store.tsx`)
Deterministic IDs link person data to timeline events:
```
auto_birth_{personId}     → Created when person has birthYear
auto_death_{personId}     → Created when person has deathYear
auto_marriage_{p1}_{p2}   → Created when ADD_SPOUSE with marriageYear
```
- `syncPersonAutoEvents()` is called by `ADD_PERSON` and `UPDATE_PERSON`
- `upsertAutoEvent()` creates or updates (preserves user edits to description/photo)
- `DELETE_PERSON` removes all auto-events for that person
- User can still manually edit/delete auto-generated events from timeline

---

## State Management (`src/store.tsx`)

### Actions
```
ADD_PERSON        → Add person + auto-generate birth/death timeline events
UPDATE_PERSON     → Update person + sync auto-events (add/remove/update)
DELETE_PERSON     → Delete person + remove from units + remove auto-events + clean marriage events
ADD_SPOUSE        → Link as spouses + auto-generate marriage event if marriageYear given
ADD_CHILD         → Link parent→child
ADD_EVENT         → Add manual timeline event
UPDATE_EVENT      → Edit event
DELETE_EVENT      → Remove event
LOAD_SAMPLE       → Replace all data with SAMPLE_DATA
MERGE_SAMPLE      → Merge SAMPLE_DATA into existing
CLEAR_ALL         → Reset to empty
LOAD_STATE        → Replace entire state (used for Supabase sync & family switching)
```

### StoreProvider
- Takes `familyId` prop → data stored at localStorage key `family-tree-data-{familyId}`
- Re-loads data when `familyId` changes (family switching)
- Auto-saves to localStorage on every state change

---

## Key Component Details

### FamilyTree.tsx (main canvas)
- **Pan & zoom**: Mouse drag to pan, wheel to zoom (towards cursor), +/−/reset buttons
- **Transform**: `translate(x, y) scale(s)` on the tree content div
- **Detail panel**: Right-side slide panel showing person details + Edit/Delete buttons
- **Export**: `treeContentRef` div captured by html2canvas for PNG/PDF export
- **Toolbar**: Add Person, Link, Event buttons + ⋯ menu (Export PNG, Export PDF, Load Sample, Clear All)
- **Modals**: AddPerson, EditPerson, AddRelationship, AddEvent, EditEvent
- **Zoom controls**: Positioned above timeline strip when timeline is visible

### Timeline.tsx
- Collapsible bottom panel (toggle bar + 210px content area)
- Events sorted by year, cards alternate above/below the time axis
- Connected to axis by colored lines + dots
- Zoom: Ctrl+Scroll (0.3×–4×), +/− buttons, scroll to pan
- Hover shows delete ✕, click opens edit modal
- Related person mini-avatars shown on each card

### AuthPage.tsx
- Five views: sign-in, sign-up, family-select, family-create, family-join
- Family selection shows cards with member counts, roles, leave button
- Share code displayed as monospace badge in header
- Password confirmation on sign-up

---

## Styling Approach
- **Tailwind CSS v4** with `@import "tailwindcss"` (no config file needed)
- Gradient avatars per person (gender-based palettes, 8 male + 8 female)
- Glassmorphism: `backdrop-blur-md`, `bg-white/80`, `shadow-xl`
- Responsive: `hidden sm:inline` for toolbar labels
- Animations: `.animate-in` keyframe for modal entrance
-> Color scheme: Indigo/purple primary, amber/orange for timeline

---

## Known Gaps / Next Agent TODO

### 1. **Wire Supabase for tree data** (highest priority)
Currently auth uses Supabase but tree data uses localStorage. Need to:
- Replace localStorage read/write in `StoreProvider` with Supabase queries
- `loadFromStorage(familyId)` → `supabase.from('persons').select().eq('family_id', familyId)` etc.
- `saveToStorage()` → debounced writes to Supabase after each state change
- Convert between snake_case DB rows and camelCase frontend types
- Handle real-time subscriptions: `supabase.channel().on('postgres_changes', ...)`

### 2. **Photo uploads to Supabase Storage**
- `PersonForm` and `EventForm` currently store photos as base64 data URLs in state
- Should upload via `supabase.storage.from('photos').upload()` and store the public URL
- Helpers already exist in `src/lib/supabase.ts`: `uploadPhoto()`, `deletePhoto()`, `dataUrlToFile()`

### 3. **Real-time collaboration**
- Supabase Realtime is configured in schema.sql but not subscribed to in the app
- Need to subscribe to INSERT/UPDATE/DELETE on persons, family_units, timeline_events
- Merge incoming changes into reducer state

### 4. **Share code copying**
- Share code shown in header but no copy-to-clipboard button
- Add `navigator.clipboard.writeText()` with a toast notification

### 5. **Mobile/touch support**
- Pan/zoom is mouse-only; needs touch event handlers for mobile
- Timeline horizontal scroll works on touch but zoom (Ctrl+scroll) doesn't

### 6. **Undo/redo**
- No undo support; accidental deletes are permanent
- Could implement with a command pattern or immer-patches

---

## Environment Variables

```
VITE_SUPABASE_URL=https://project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ... (public anon key, safe to expose in frontend)
```

## Build & Run

```bash
npm install          # Install dependencies
npm run dev          # Dev server on localhost:5173
npm run build        # Production build → dist/index.html (single-file)
npm run preview      # Preview production build
```

## Deployment

See `DEPLOYMENT.md` for the complete 8-step guide:
1. Create Supabase project
2. Run `supabase/schema.sql` in SQL Editor
3. Copy API keys
4. Configure email auth
5. Push to GitHub
6. Deploy to Vercel (add env vars)
7. Add Vercel URL to Supabase redirect URLs
8. Share URL + share code with family
