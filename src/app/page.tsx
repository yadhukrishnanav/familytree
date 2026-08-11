'use client';

// Family Tree — Main app entry
// Renders AuthPage when unauthenticated, otherwise the FamilyTree workspace.

import { AuthProvider, useAuth } from '@/features/family-tree/auth';
import { StoreProvider } from '@/features/family-tree/store';
import { AuthPage } from '@/features/family-tree/components/AuthPage';
import { FamilyTree } from '@/features/family-tree/components/FamilyTree';
import { TreePine } from 'lucide-react';

function AppContent() {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 via-white to-amber-50">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-amber-500 shadow-lg">
            <TreePine className="h-6 w-6 text-white" />
          </div>
          <p className="text-sm text-slate-500">Loading Family Tree…</p>
        </div>
      </div>
    );
  }

  if (!auth.user || !auth.activeFamily) {
    return <AuthPage />;
  }

  return (
    <StoreProvider familyId={auth.activeFamily.id}>
      <FamilyTree />
    </StoreProvider>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
