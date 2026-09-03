'use client';

// Family Tree — Auth page
// Routes between the sign-in/sign-up form (which now contains the inline
// family-code quick-access form), family-select, family-create, and
// family-join views.
//
// The QuickAccess shortcut flow is now INLINE on the sign-in form — no
// separate page. Users enter their code directly on the landing page,
// and go straight to the canvas (no intermediary screens).

import { useState } from 'react';
import { TreePine } from 'lucide-react';
import { useAuth } from '../auth';
import { useLandingLocation } from '../useLandingLocation';
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

  // While a QuickAccess (family code) join is in progress, keep showing the
  // AuthForms (with the spinner on the button). This prevents the "Welcome /
  // Create a family" intermediary screen from flashing between signUp
  // (sets auth.user) and joinFamily (sets activeFamily).
  if (auth.quickJoining) {
    return <AuthForms initialView="sign-in" setView={setView} />;
  }

  if (!auth.user) {
    return <AuthForms initialView={view} setView={setView} />;
  }
  // Signed in, but the family list hasn't loaded yet. Show the loader —
  // NOT the Welcome screen — otherwise members see a "create or join" flash
  // between sign-in and the canvas (and got stuck there if the query failed).
  if (auth.familiesLoading && !auth.activeFamily) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
            <TreePine className="h-6 w-6 text-white" />
          </div>
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      </div>
    );
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
