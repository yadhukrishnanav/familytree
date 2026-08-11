# Family Tree — Multi-Agent Worklog

---
Task ID: 1
Agent: main (orchestrator)
Task: Continue the Family Tree project from HANDOVER.md. The original source code was missing from the workspace, so the user asked me to (a) rebuild the project from the spec, (b) port it from React+Vite to Next.js 16, (c) implement all 6 TODOs from the handover (Supabase sync, photo uploads, realtime, share-code copy, mobile/touch, undo/redo), and (d) install deps + run the dev server in this workspace.

Work Log:
- Read `/home/z/my-project/upload/HANDOVER.md` to understand the original React+Vite+Supabase Family Tree project.
- Verified no source code existed in the workspace — only the handover doc.
- Used AskUserQuestion to confirm: rebuild from spec, port to Next.js, implement all 6 TODOs, run in-workspace.
- Loaded `fullstack-dev` skill and ran the init script (`curl https://z-cdn.chatglm.cn/fullstack/init-fullstack.sh | bash`) to scaffold Next.js 16 + shadcn/ui + Prisma project.
- Installed runtime deps: `@supabase/supabase-js`, `html2canvas`, `jspdf`.
- Created feature module under `src/features/family-tree/`:
  - `types.ts` — Person, FamilyUnit, TimelineEvent, FamilyTreeState, Action, layout types.
  - `supabase.ts` — Supabase client init with `isSupabaseConfigured` check; gracefully falls back to "demo mode" (localStorage + base64 photos) when env vars are missing/placeholder. Helpers: `uploadPhoto`, `deletePhoto`, `fileToDataUrl`, `dataUrlToFile`.
  - `data.ts` — SAMPLE_DATA (15 persons, 4 family units, 10 timeline events) + avatar palette arrays + `pickAvatarColors`.
  - `layout.ts` — `computeLayout()` auto-layout algorithm with NODE_WIDTH=180, NODE_HEIGHT=100, GENERATION_GAP=140; emits nodes + connections (marriage / junction / parent-child).
  - `reducer.ts` — Pure reducer handling ADD/UPDATE/DELETE_PERSON, ADD_SPOUSE, ADD_CHILD, ADD/UPDATE/DELETE_EVENT, LOAD_SAMPLE, MERGE_SAMPLE, CLEAR_ALL, LOAD_STATE; includes auto-event system (auto_birth_*, auto_death_*, auto_marriage_{p1}_{p2}).
  - `sync.ts` — `loadTreeFromSupabase`, `saveTreeToSupabase` (debounced diff-and-upsert), `subscribeToTreeChanges` (postgres_changes on persons/family_units/timeline_events), `applyRealtimeChange` for merging incoming rows. snake_case ↔ camelCase conversion.
  - `auth.tsx` — AuthProvider with `signIn`, `signUp`, `signOut`, `createFamily`, `joinFamily`, `setActiveFamilyId`, `refreshFamilies`. Demo-mode fallback stores users/families/memberships in localStorage with simple hashing.
  - `store.tsx` — StoreProvider wrapping `useReducer` with: initial load (localStorage first → Supabase), debounced 800ms Supabase saves, realtime subscription (clears undo history on remote change), undo/redo history (max 50 snapshots), keyboard shortcuts (Ctrl/Cmd+Z, Shift+Z, Ctrl+Y), `useStore` hook.
  - `export.ts` — `exportToPngFile`, `exportToPdfFile` via html2canvas + jsPDF.
- Created UI components under `src/features/family-tree/components/`:
  - `PersonCard.tsx` — 180×100 card with photo/avatar gradient, name, lifespan, occupation, birthplace, gender stripe, "IN MEMORIAM" badge for deceased.
  - `PersonForm.tsx` — Add/edit form with photo upload, 8 avatar palettes per gender, year validation, all fields from spec.
  - `RelationshipForm.tsx` — Two modes: spouse (with marriage year) or parent→child; uses shadcn Select for person pickers.
  - `EventForm.tsx` — Year, title, description, icon (9 options), color picker, photo upload, multi-select related persons.
  - `Timeline.tsx` — Collapsible bottom strip, zoom (Ctrl+scroll + buttons + pinch), decade ticks, alternating above/below cards with mini person avatars, hover-to-delete.
  - `AuthPage.tsx` — 5 views: sign-in, sign-up, family-select (with copy-share-code button), family-create, family-join. Demo-mode badge.
  - `FamilyTree.tsx` — Main canvas with pan/zoom (mouse drag, wheel-to-cursor, touch pan, pinch zoom), zoom buttons, detail panel (right side), toolbar (Add Person / Link / Event / ⋯ menu), share code in header (click to copy), undo/redo buttons, export PNG/PDF, load sample, clear all. Empty state.
- Updated `src/app/page.tsx` to render AuthProvider → AppContent → (AuthPage | StoreProvider → FamilyTree).
- Updated `src/app/layout.tsx`: metadata for Family Tree, added Sonner toaster for toasts.
- Created `supabase/schema.sql` — Tables (families, family_members, persons, family_units, timeline_events), `is_family_member()` helper, RLS policies for all tables, trigger to auto-add family creator as owner, `photos` storage bucket with public-read + authenticated-write policies, realtime publication.
- Created `.env.example` documenting `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Added `allowedDevOrigins` to `next.config.ts` to silence the cross-origin preview warning.
- Fixed two bugs discovered via agent-browser testing:
  1. `react-hooks/preserve-manual-memoization` lint error in Timeline.tsx — inlined `yearToX` into the `useMemo` so deps array matches.
  2. `refreshFamiliesFor` accessed before declaration in auth.tsx — moved the `useCallback` above the `useEffect` that uses it.
  3. Undo/redo history bug: `skipNextHistory` flag set inside undo()/redo() persisted into the next user action, causing it to be skipped from history. Removed the flag entirely since `rawDispatch` is called directly (bypassing the wrapped dispatch), so external LOAD_STATE calls never hit the history-tracking path anyway.
- Ran ESLint — 0 errors, 0 warnings.
- Used `agent-browser` to verify end-to-end:
  - Sign-up flow: created demo@test.com account → saw "Create a family" screen.
  - Family create: created "The Sharma Family" → got share code 6P67GL.
  - Empty state: saw "Start your family tree" with Add Person / Load sample buttons.
  - Load sample: 15 persons rendered with proper 4-generation layout, marriage lines, and 10 timeline events.
  - Person detail panel: clicked Rajesh → panel opened with Edit/Delete buttons and family relations.
  - Undo: clicked Undo → sample data cleared, Redo enabled.
  - Add Person form: added "Aisha Kapoor 1992, Photographer, Bangalore" → card appeared, auto-birth event generated, success toast shown.
  - Undo bug fix verified: after undo then add person, undo button correctly enabled (previously was disabled).
  - Share code copy: clicked "6P67GL" button → toast "Share code copied! 6P67GL is ready to paste."
  - Mobile viewport (375×812): toolbar labels collapse to icons, no overflow, layout intact.
  - Event form: added "Big Family Vacation 2020" linked to two persons → event appeared in timeline, toast shown.
- VLM verification confirmed: 4-generation tree visible, marriage lines + parent-child junctions rendered, timeline with 10 events at bottom, no UI defects.

Stage Summary:
- Project fully rebuilt on Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui + Supabase, matching every feature described in HANDOVER.md.
- All 6 TODOs implemented:
  1. ✅ Supabase sync for tree data (`sync.ts` + `store.tsx` debounce)
  2. ✅ Photo uploads to Supabase Storage (`uploadPhoto`/`deletePhoto` in `supabase.ts`, used by PersonForm & EventForm)
  3. ✅ Realtime collaboration (`subscribeToTreeChanges` + `applyRealtimeChange`)
  4. ✅ Share code copy with toast (header button + AuthPage family cards)
  5. ✅ Mobile/touch support (touch pan, pinch zoom on canvas + timeline)
  6. ✅ Undo/redo with keyboard shortcuts (Ctrl/Cmd+Z, Shift+Z) + history UI in header
- "Demo mode" fallback: when `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing or placeholder, the app runs entirely on localStorage + base64 photos so the workspace preview works without real Supabase credentials. Drop in real credentials via `.env.local` and the same code path switches to Supabase auth + DB + storage + realtime.
- Lint: 0 errors, 0 warnings.
- Dev server: running on port 3000, GET / returns 200.
- Artifacts produced:
  - `src/features/family-tree/{types,supabase,data,layout,reducer,sync,auth,store,export}.ts(x)`
  - `src/features/family-tree/components/{PersonCard,PersonForm,RelationshipForm,EventForm,Timeline,AuthPage,FamilyTree}.tsx`
  - `src/app/page.tsx`, `src/app/layout.tsx` (updated)
  - `supabase/schema.sql`, `.env.example`, `next.config.ts` (allowedDevOrigins added)
  - Screenshots: `scripts/01-sample-loaded.png`, `scripts/02-mobile.png`, `scripts/03-final-state.png`
