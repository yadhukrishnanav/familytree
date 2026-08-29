'use client';

import { AuthProvider, useAuth } from '@/features/family-tree/auth';
import { I18nProvider } from '@/features/family-tree/i18n';
import { StoreProvider } from '@/features/family-tree/store';
import { AuthPage } from '@/features/family-tree/components/AuthPage';
import { FamilyTree } from '@/features/family-tree/components/FamilyTree';
import { TreePine } from 'lucide-react';

function AppContent() {
  const auth = useAuth();

  if (auth.loading) {
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

  if (!auth.user || !auth.activeFamily) {
    return <AuthPage />;
  }

  return (
    <StoreProvider
      familyId={auth.activeFamily.id}
      actor={auth.user ? { id: auth.user.id, email: auth.user.email } : null}
    >
      <FamilyTree />
    </StoreProvider>
  );
}

export default function Home() {
  return (
    <I18nProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </I18nProvider>
  );
}
// Build trigger: Sat Aug 29 12:10:58 UTC 2026
