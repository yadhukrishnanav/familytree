// Shared view-routing type for the auth flow.
// Defined here (not in AuthPage.tsx) so the 6 extracted components can import
// it without creating a circular dependency on AuthPage.tsx.
export type View =
  | 'sign-in'
  | 'sign-up'
  | 'family-select'
  | 'family-create'
  | 'family-join'
  | 'quick-access';
