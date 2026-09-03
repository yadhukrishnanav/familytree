'use client';

// Family Tree — App Router error boundary
// Replaces Next's generic "Application error" overlay with a friendly
// recovery screen. Deploy-related chunk failures auto-heal (purge SW + caches,
// reload once); everything else gets buttons.

import { useEffect, useState } from 'react';
import { TreePine, RefreshCw, Trash2 } from 'lucide-react';
import { isChunkLoadError, recoverFromChunkError, clearLocalDataAndReload } from '@/features/family-tree/errorRecovery';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Derived once from the error itself (no setState-in-effect): chunk errors
  // mean a deploy happened mid-session and the recovery flow reloads the page.
  const [recovering] = useState(() => isChunkLoadError(error?.message));

  useEffect(() => {
    // Deploy mismatch (old tab requests a chunk that 404'd on the new
    // deployment) — purge caches + reload automatically, no user action.
    if (recovering) recoverFromChunkError(error);
  }, [error, recovering]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white/90 p-8 text-center shadow-xl ring-1 ring-slate-200">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
          <TreePine className="h-7 w-7 text-white" />
        </div>
        <h1 className="mb-2 text-xl font-bold text-slate-800">Something went wrong</h1>
        <p className="mb-6 text-sm text-slate-500">
          {recovering
            ? 'Updating the app — reloading…'
            : 'The page hit an unexpected error. Reloading usually fixes it.'}
        </p>
        {error?.digest && (
          <p className="mb-4 font-mono text-[11px] text-slate-400">ref: {error.digest}</p>
        )}
        {!recovering && (
          <div className="space-y-2">
            <button
              onClick={() => reset()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-3 font-semibold text-white shadow-md transition hover:from-emerald-700 hover:to-teal-600"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              Reload page
            </button>
            <button
              onClick={clearLocalDataAndReload}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs text-slate-400 transition hover:text-red-600"
              title="Clears cached app data in this browser, then reloads"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear local data &amp; reload
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
