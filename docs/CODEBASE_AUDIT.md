# Family Tree — Codebase & CSS Scheme Audit

Audited on 2026-09-02 against the `arena/01a060d4-familytree` checkout.

---

## 1. Headline bug: guest entering a family code is bounced back to auth / welcome screen

**Root cause (now fixed in `src/features/family-tree/auth.tsx` + `AuthForms.tsx`):**

The Quick Access flow runs `signUp()`/`signIn()` and `joinFamily()` inside the **same event handler**. React does not re-render between those awaits, so `auth.user` inside the handler is still the *old* value (`null`). `joinFamily()` then saw `user === null` and returned `"Not signed in"`. Because the quick-join had already created the guest account, the auth screen then rendered the "Welcome / Create family" intermediary screen instead of the tree canvas.

**Fix applied:**

- `signIn()` now returns the signed-in `user` (not just `error`).
- `joinFamily(shareCode, userIdOverride?)` now accepts an explicit user id for this fast-path.
- `AuthForms.handleQuickAccess` passes the `id` returned from `signUp()`/`signIn()` into `joinFamily()`, so the join uses the freshly created guest instead of the stale `auth.user`.
- Demo-mode `joinFamily()` now also returns the joined `family` (previously returned `{}`), so the FamilySwitcher toast can show the family name consistently.

**Expected result:** entering a valid family code on the auth screen now goes straight to the `FamilyTree` canvas with no Welcome / Family-Select flash.

---

## 2. High-priority flaws

### 2.1 Security: `families` share codes are exposed to every authenticated user
`supabase/schema.sql` uses:

```sql
create policy "families_select_member" on public.families
    for select to authenticated using (true);
```

That leaks every family name **and share code** to any signed-in user. The comment says it is needed for the `INSERT ... RETURNING` path in `createFamily()`, but that is a solvable problem (use `return=minimal`/an RPC, or scope the SELECT to the newly inserted row). The share code is the secret that gates joining.

- **Recommended:** make `families` select member-only, and switch `createFamily()` to use the `join_family_by_code`-style RPC or `select()` with a temporary/insert-scoped grant.

### 2.2 Security: no rate limit on `join_family_by_code`, short codes
Codes are `Math.random().toString(36).slice(2, 8).toUpperCase()` — 6 base-36 characters (~2.17B possibilities). The RPC is callable by any authenticated user with no rate limiting. An attacker with a valid login can brute-force join arbitrary families.

- **Recommended:** longer/lexically random codes (e.g. 8–10 chars), a per-user attempt rate limit in the RPC, and/or an invite-dependent flow.

### 2.3 Schema role mismatch: "admin" vs "owner"
The app treats `admin` as the creator/top role, but the first part of `schema.sql` still creates `family_members` with `check (role in ('owner','editor'))`, and the original `families_delete_owner` / `members_delete_self_or_owner` policies only allow `owner`. `admin` is added by a later `alter` / `fix-rls.sql`, and the trigger is recreated to insert `admin`, but the base file is inconsistent:

- `families_delete_owner` only checks `role = 'owner'` (not `admin`).
- `members_delete_self_or_owner` only checks `role = 'owner'` (not `admin`).
- `fix-rls.sql` re-creates the correct policies, so the codebase carries two divergent policy sources.

- **Recommended:** make `schema.sql` the single source of truth; use `role in ('admin','owner')` everywhere, and delete or clearly mark `fix-rls.sql` as a migration with versioning.

### 2.4 Collaboration: last-write-wins sync can silently drop changes
`saveTreeToSupabase()` upserts all rows for a family after a debounce. Two members editing at the same time will overwrite each other's person/event rows. There is no row-level `updated_at` conflict check, no `version`, and no merge.

- **Recommended:** add `updated_at` per row and an `if-match`/conditional upsert; or at minimum add a dirty-origin / merge pass for concurrent edits.

### 2.5 Missing UI: existing people can’t be linked
`RelationshipForm.tsx` (spouse + parent→child + validation) is implemented but **not imported or opened anywhere**. The toolbar has no "Link" action. Relationships can only be created while adding a *new* person via `PersonForm`. Once persons exist, there is no way to link two of them.

- **Recommended:** wire `RelationshipForm` back into the toolbar (or the person detail/context menu) with a modal.

### 2.6 Dead / unfinished modules
- `src/features/family-tree/i18n.tsx` (`I18nProvider`/`useI18n`) is never wired into the app.
- `RelationshipForm.tsx` is unused (see above).
- `src/app/api/route.ts` is a Hello World endpoint.
- `prisma/schema.prisma` + `src/lib/db.ts` are leftover scaffolding (SQLite Users/Posts) while the real backend is Supabase.
- `next-intl`, `react-markdown`, `@mdxeditor/editor`, `recharts`, `@tanstack/react-table`, `@dnd-kit/*`, `pg` are in `package.json` but not obviously used by `src/`.

- **Recommended:** remove or move to a separate branch/demo module, or document intent.

### 2.7 Build quality settings are off
`next.config.ts`:

```ts
typescript: { ignoreBuildErrors: true },
reactStrictMode: false,
```

This hides real type errors and disables Strict Mode. The repo currently can't run `npm run lint` or `npx tsc` because `node_modules` is not installed in this checkout (eslint/tsc missing), but the config should be fixed anyway.

- **Recommended:** install deps, run `tsc --noEmit`, fix errors, then re-enable strict checking and Strict Mode (after verifying no double-mount issues).

### 2.8 Person profile fields are not typed / not persisted
`PersonForm` reads/writes `phone`, `email`, `instagram`, `facebook`, `twitter`, `linkedin` via `(initial as any)?.phone`, etc., and casts the object `as Person`. But `Person` in `types.ts` does not include those fields and `personToRow()`/`personToRow()` ignore them. The UI contains social fields that silently never sync to Supabase.

- **Recommended:** either extend `Person` + Supabase columns to include these fields, or remove the social/phone/email section.

---

## 3. CSS scheme audit

### 3.1 The stated goal isn’t met
`globals.css` says:

> All visual styling ... lives here as CSS classes, so components don't need inline style={{}} attributes.

In practice, the codebase still has:

- ~326 color/brand Tailwind class usages across `src/features/family-tree`.
- ~30 inline `style={{}}` usages (canvas dot grid, ambient glow, avatar gradients, timeline positions, panels, etc.).
- Static `.ft-*` classes in `globals.css` that coexist with hand-written Tailwind classes.

The result is a **mixed CSS system**: CSS variables + Tailwind utilities + `.ft-*` classnames + inline styles all used for equivalent things.

### 3.2 Palette drift
The app has multiple accent families that don't share a token:

- Brand / primary: **emerald/teal** (`#10b981`, `#14b8a6`, gradient buttons, logo, auth cards).
- Activity / members / chat: **purple/pink** (`from-purple-500`, `to-pink-500`, `text-purple-500`).
- Timeline: **amber/orange**.
- Federation: **indigo/purple**.
- Neutral base: **slate**.

This makes future “change the brand color” work painful (the same problem `constants.ts`/`globals.css` were created to solve).

### 3.3 Theme color mismatch
- `layout.tsx` `themeColor: "#8b5cf6"` (purple).
- `public/manifest.json` `theme_color: "#8b5cf6"` (purple).
- Brand in UI is emerald/teal.

Pick one (purple if that is the deliberate identity; otherwise update manifest + viewport to emerald).

### 3.4 Dark mode is incomplete
Tailwind dark mode is set up, but many `.ft-*` classes and Tailwind classes use fixed light values:

- `.ft-slide-panel`, `.ft-zoom-controls` use `rgba(255,255,255,0.95 / 0.8)`.
- `.ft-canvas-dot-grid`, `.ft-timeline-scroll`, `.ft-timeline-axis` use fixed slate colors.
- Components use `bg-white/70`, `bg-white/95`, `text-slate-800`, etc. across panels.

Dark mode will look broken or inconsistent in the tree canvas and slide-in panels.

### 3.5 Legacy / dead Tailwind config
`tailwind.config.ts` is a Tailwind v3-style config with:

```ts
content: [
  "./pages/**/*...",
  "./components/**/*...",
  "./app/**/*...",
],
```

It does not include `./src/**`, and its plugin (`tailwindcss-animate`) isn't used. The project uses Tailwind v4, which pulls tokens from `globals.css` (`@import "tailwindcss"`, `@theme inline`, `@custom-variant dark`). Either the v3 config should be deleted or converted to a proper v4 `@source`/CSS-token config.

### 3.6 Recommend a concrete CSS direction
1. Define one token set in `globals.css`: `--brand-primary`, `--brand-secondary`, `--panel`, `--panel-muted`, `--accent-info`, `--accent-success`, `--accent-warning`, `--accent-danger`, plus the existing `--ft-*` variables.
2. Replace repeated gradient/panel Tailwind strings with small utility components or CSS classes (`.ft-brand-gradient`, `.ft-panel`, `.ft-status-dot`, etc.).
3. Move the canvas dot grid and ambient glow into `.ft-*` classes (they're already defined in `globals.css` but also duplicated as inline styles in `FamilyTree.tsx`).
4. Add dark variants for `.ft-slide-panel`, `.ft-zoom-controls`, `.ft-calendar-panel`, `.ft-map-panel`, etc., and audit `bg-white/…`/`text-slate-…` usage against the `.dark` token set.
5. Remove `tailwind.config.ts` (or convert it), and align manifest/theme color with the chosen brand.

---

## 4. Additional suggestions / opportunities

- **Guest flow:** consider making guest accounts more explicit in the UI (e.g. “Continue as guest”) instead of inventing an email/password. The current flow works but creates a hidden credential in `localStorage`/Supabase.
- **Accessibility:** many icon-only toolbar buttons rely on `title` only; add `aria-label`. Several close/collapse buttons are unlabeled.
- **Search**: `SearchPalette` searches name/occupation/place but not year; fine for now.
- **CSV import:** the parser is a simple `split(',')`; quoted fields with commas will break. Consider a small CSV parser or document the limitation.
- **PWA shortcuts:** `manifest.json` advertises `/?action=add-person` and `/?action=activity`, but the app never reads the `action` query param, so installed shortcuts land on the normal landing page. Either implement the query handling or remove the shortcuts.
- **Nominatim policy:** the map geocoder rate-limits correctly, but has no user-agent in a browser (referer is sent automatically); fine, but consider a server proxy for production.
- **Activity revert:** `ADD_SIBLING`, `PARENT_SIBLING_GROUP`, `ADD_SPOUSE` (when reverting add-spouse) are not fully revertible via the activity panel; the panel says “not supported” and suggests Ctrl+Z.
- **Export:** PDF generation is simple single-page; large trees will be clipped. Consider tiling/scale-to-fit behind a page-count budget.

---

## 5. Priority recommendation

| Priority | Item |
|---|---|
| P0 | Fix Quick Access auth bounce (done). |
| P0 | Restrict `families` SELECT / protect share codes. |
| P0 | Unify admin/owner policy in `schema.sql`; remove `fix-rls.sql` drift. |
| P1 | Re-enable TypeScript build/Strict Mode; remove ignored build errors. |
| P1 | Wire RelationshipForm back into the toolbar. |
| P1 | Improve Supabase sync conflict handling (updated_at/conditional update). |
| P1 | Centralize CSS tokens + fix dark mode + align theme color. |
| P2 | Rate-limit join codes; longer codes. |
| P2 | Remove dead scaffolding (Prisma/i18n/api/route, unused packages). |
| P2 | Type + persist (or remove) the social/person contact fields. |
| P2 | Implement PWA shortcut `?action=` handling. |
