'use client';

// Family Tree — Global error boundary (root-level, replaces the whole HTML
// document). Next renders its generic "Application error: a client-side
// exception has occurred" page when no global-error.tsx exists. This one
// self-heals deploy-related chunk failures and otherwise offers recovery
// buttons instead of a dead end.

import { useEffect, useState } from 'react';
import { TreePine, RefreshCw, Trash2 } from 'lucide-react';
import { isChunkLoadError, recoverFromChunkError, clearLocalDataAndReload } from '@/features/family-tree/errorRecovery';

export default function GlobalError({
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
    if (recovering) recoverFromChunkError(error);
  }, [error, recovering]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 50%, #f0fdfa 100%)',
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: '1rem',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            textAlign: 'center',
            background: 'rgba(255,255,255,0.92)',
            borderRadius: 16,
            padding: '2rem',
            boxShadow: '0 10px 40px rgba(15,23,42,0.08)',
            border: '1px solid #e2e8f0',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              margin: '0 auto 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 16,
              background: 'linear-gradient(135deg, #10b981, #0d9488)',
              boxShadow: '0 8px 20px rgba(13,148,136,0.35)',
            }}
          >
            <img src="/logo.svg" alt="" width={28} height={28} />
          </div>
          <h1 style={{ margin: '0 0 0.5rem', fontSize: 20, color: '#1e293b' }}>
            Something went wrong
          </h1>
          <p style={{ margin: '0 0 1.5rem', fontSize: 14, color: '#64748b' }}>
            {recovering
              ? 'Updating the app — reloading…'
              : 'The page hit an unexpected error. Reloading usually fixes it.'}
          </p>
          {error?.digest && (
            <p style={{ margin: '0 0 1rem', fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
              ref: {error.digest}
            </p>
          )}
          {!recovering && (
            <div style={{ display: 'grid', gap: 8 }}>
              <button
                onClick={() => reset()}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', padding: '0.75rem', border: 'none', borderRadius: 12,
                  background: 'linear-gradient(90deg, #059669, #14b8a6)',
                  color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer',
                }}
              >
                <RefreshCw width={16} height={16} /> Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  width: '100%', padding: '0.6rem', borderRadius: 12, cursor: 'pointer',
                  background: '#fff', border: '1px solid #e2e8f0', color: '#334155',
                  fontSize: 14, fontWeight: 500,
                }}
              >
                Reload page
              </button>
              <button
                onClick={clearLocalDataAndReload}
                title="Clears cached app data in this browser, then reloads"
                style={{
                  width: '100%', padding: '0.5rem', border: 'none', background: 'none',
                  color: '#94a3b8', fontSize: 12, cursor: 'pointer',
                }}
              >
                <Trash2 width={14} height={14} style={{ verticalAlign: -2 }} /> Clear local data &amp; reload
              </button>
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
