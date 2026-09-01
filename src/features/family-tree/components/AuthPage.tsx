'use client';

// Family Tree — Auth page
// Five views: sign-in, sign-up, family-select, family-create, family-join
// (plus the Quick Access shortcut flow for elders joining via family code).
//
// The 6 view components live in `./auth/` and are imported here. This file
// only holds the top-level `AuthPage` (which routes between views) and the
// shared `View` type (re-exported from `./auth/types` for any external use).

import { useState } from 'react';
import { useAuth } from '../auth';
import { useLandingLocation } from '../useLandingLocation';
import { QuickAccess } from './auth/QuickAccess';
import { AuthForms } from './auth/AuthForms';
import { FamilyCreateOrJoin } from './auth/FamilyCreateOrJoin';
import { CreateFamily } from './auth/CreateFamily';
import { JoinFamily } from './auth/JoinFamily';
import { FamilySelect } from './auth/FamilySelect';
import type { View } from './auth/types';

// Re-export so any legacy `import { View } from './AuthPage'` still resolves.
export type { View } from './auth/types';

export function AuthPage() {
  const auth = useAuth();
  const [view, setView] = useState<View>(auth.user ? 'family-select' : 'sign-in');

  // Silently ask for geolocation permission at landing. The browser shows its
  // native prompt (no app-level banner). Result is cached in localStorage so
  // PersonForm can later pre-fill the birthplace field. No visible UI.
  useLandingLocation();

  // QuickAccess is a one-shot flow: user enters code -> we auto-create a guest
  // account -> we join the family. While this flow is mid-flight (after signUp
  // sets auth.user but before joinFamily sets activeFamily), we MUST keep
  // showing the QuickAccess screen — otherwise AuthPage would re-render and
  // route the now-signed-in user to the "Create a family / Join with a code"
  // intermediary screen, defeating the whole point of Quick Access.
  if (view === 'quick-access' && !auth.activeFamily) {
    return <QuickAccess auth={auth} setView={setView} />;
  }

  if (!auth.user) {
    return <AuthForms initialView={view} setView={setView} />;
  }
  // If user has families, go straight to family-select (or the active family)
  if (auth.families.length > 0 && auth.activeFamily) {
    // The page.tsx will render FamilyTree since auth.user and auth.activeFamily are set
    return null;
  }
  if (auth.families.length === 0 && view !== 'family-create' && view !== 'family-join') {
    return <FamilyCreateOrJoin setView={setView} />;
  }
  if (view === 'family-create') {
    return <CreateFamily setView={setView} />;
  }
  if (view === 'family-join') {
    return <JoinFamily setView={setView} />;
  }
  return <FamilySelect setView={setView} />;
}
