'use client';

// Family Tree — Canvas-scoped error boundary
// A crash inside the canvas (render error, plugin code, bad data) must NOT
// take down the whole page — previously the page-level error boundary
// unmounted the auth context too, so the user appeared to be signed out and
// landed back on the auth screen. This boundary contains the blast radius:
// header, auth state and store stay alive; only the canvas area shows a
// recovery card. "Restart canvas" remounts just the canvas.

import { Component } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Keep the real cause in the console for debugging.
    console.error('Canvas crashed (contained by CanvasErrorBoundary):', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center p-6">
          <div className="max-w-sm rounded-2xl bg-white/90 p-6 text-center shadow-lg ring-1 ring-slate-200">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
            <h2 className="mb-1 text-lg font-bold text-slate-800">The canvas hit an error</h2>
            <p className="mb-4 text-sm text-slate-500">
              Your tree data is safe. Restart the canvas view to continue.
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              className="mx-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2.5 font-semibold text-white shadow-md transition hover:from-emerald-700 hover:to-teal-600"
            >
              <RefreshCw className="h-4 w-4" /> Restart canvas
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
