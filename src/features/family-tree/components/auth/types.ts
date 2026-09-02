// Shared view-routing type for the auth flow.
// Defined here (not in AuthPage.tsx) so the 6 extracted components can import
// it without creating a circular dependency on AuthPage.tsx.
//
// Note: 'quick-access' was removed — the quick-access form is now INLINE on
// the sign-in form (in AuthForms.tsx), no separate page needed.
export type View =
  | 'sign-in'
  | 'sign-up'
  | 'family-select'
  | 'family-create'
  | 'family-join';
